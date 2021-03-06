import { Do, CompileError, arrayLast, Crash, Field, Code, assert, cast, Choice, assertDefined, trap, Item, Reference, Statement, arrayRemove } from "./exports";

/** a try block is the basic control structure of Subtext. It contains a sequnce
 * of do-blocks called clauses. The clauses are executed in order until one does
 * not reject */
export class Try extends Code {

  /** evaluate, setting this.result to first successful clause, else
   * this.rejected. this.conditional true if fall-through rejects instead of crashing
   * */
  eval() {
    if (this.result || this.rejected) {
      // aleady evaluated
      return;
    }

    if (this.analyzing) {

      // during analysis first clause becomes result, other clauses queued for
      // later analysis to allow recursion

      /** FIXME - this has caused so much pain! Needed to allow implicitly
          recursive functions. Instead have an explicit `recursive-type exp`
          statement following the arguments. Maybe too late for this
          implementation. Note recursive choices will probably still need
          deferred analysis and copying */

      let first = this.fields[0];
      for (let clause of this.fields) {
        /** function to analyze clause */
        const analyzeClause = () => {
          clause.eval();
          if (
            !clause.conditional && (
              this.conditional
              || clause !== arrayLast(this.fields)
            )
          ) {
            throw new CompileError(clause,
              'clause must be conditional if not last'
            )
          }
          first.eval();
          if (clause === first) {
            // set first clause as result during analysis
            this.result = first;
            // uncopy first clause result to break value provenance
            (cast(first.get('^code').value, Code).result!).uncopy();
          } else {
            // not first clause
            if (!first.value!.updatableFrom(clause.value!)) {
              // type incompatible with first clause
              //result')
              // assert type error on the clause itself
              let code = clause.get('^code');
              // note overriding eval errors in clause
              code.editError = 'type';
              assert(!code.isDerived); // to be sure error sticks
              clause.propagateError(code);
            }
            if (this.getMaybe('^export') && !clause.getMaybe('^export')) {
              throw new CompileError(clause, 'all clauses must export')
            }
          }
        }
        if (clause === first) {
          // immediately analyze first clause, setting result type
          analyzeClause();
        } else if (!clause.deferral) {
          // defer secondary clauses so they can make recursive calls
          // but ignore if a deferred copy of a deferred clause
          assert(clause.evaluated === false);
          clause.evaluated = undefined;
          clause.deferral = analyzeClause;
          this.workspace.analysisQueue.push(clause);
        }
        continue;
      }

      // if first clause exports, export a choice combining all exports
      let exportField = first.getMaybe('^export');
      if (exportField) {
        // export choice from clause exports
        let choice = new Choice;
        this.export = this.containingItem.setMeta('^export', choice);
        this.export.conditional = this.conditional;
        this.fields.forEach(clause => {
          let option = new Field;
          // option adopts name of clause
          if (clause.id.name === undefined) {
            throw new CompileError(clause, 'exporting clause must be named')
          }
          option.id = clause.id;
          choice.add(option);
          option.io = 'input';
          option.conditional = true;
          // defer defining option value till clauses analyzed
          this.export!.workspace.analysisQueue.push(option);
          option.deferral = () => {
            clause.resolve();
            let clauseExport = cast(clause.get('^code').value, Code).export;
            if (!clauseExport) {
              throw new CompileError(clause, 'all clauses must export')
            }
            // export to option value
            this.fieldImport(option, clauseExport);
            option.eval();
          }
        })
      }

      return;
    }

    // at runtime evaluate clauses until success
    for (let clause of this.fields) {
      clause.eval();
      if (!clause.rejected) {
        // stop on success when not analyzing
        this.result = clause;
        this.propagateError(clause);
        if (clause.get('^code').editError === 'type') {
          // Set result to first clause to get correct type
          this.result = this.fields[0];
        }
        // set export choice
        this.export = this.containingItem.getMaybe('^export');
        if (this.export) {
          let choice = cast(this.export.value, Choice);
          let option = choice.setChoice(this.fields.indexOf(clause))
          option.detachValueIf();
          option.copyValue(assertDefined(clause.getMaybe('^export')));
        }
        break;
      }
    }

    // reject or crash on fall-through
    if (!this.result) {
      if (this.conditional) {
        this.rejected = true;
        let exportField = this.getMaybe('^export');
        if (exportField) {
          exportField.rejected = true;
        }
      } else {
        throw new Crash(arrayLast(this.fields).id.token!, 'try failed')
      }
    }
  }

  /** nested write statements. During analysis merges writes of clauses */
  writeStatements(): Statement[] {
    if (!this.analyzing) {
      // when not analyzing use only the executed clause
      for (let clause of this.statements) {
        if (!clause.rejected) {
          return clause.writeStatements();
        }
      }
      return [];
    }
    // during analysis merge write statements from each clause
    let mergedWrites: Statement[] = [];
    for (let clause of this.statements) {
      let prevMerged = mergedWrites.slice();
      writeLoop: for (let write of clause.writeStatements()) {
        let writeTarget = cast(write.get('^target').value, Reference).target!;
        // scan writes merged from previous clauses
        for (let merged of prevMerged) {
          let mergedTarget =
            cast(merged.get('^target').value, Reference).target!;
          if (writeTarget === mergedTarget) {
            // drop the write
            continue writeLoop;
          }
          if (
            writeTarget.contains(mergedTarget)
            && writeTarget.writeSink(mergedTarget)!.io !== 'interface'
          ) {
            // drop contained merged write unless within interface
            arrayRemove(mergedWrites, merged);
          } else if (
            mergedTarget.contains(writeTarget)
            && mergedTarget.writeSink(writeTarget)!.io !== 'interface'
          ) {
            // drop contained write unless within interface
            continue writeLoop;
          }
        }
        mergedWrites.push(write);
        continue writeLoop;
      }
    }
    return mergedWrites;
  }

}