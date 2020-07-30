import { Do, StaticError, arrayLast, Crash, Field, Code, assert, cast, Choice, assertDefined, trap, Item, Reference, Statement } from "./exports";

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

    if (this.workspace.analyzing) {

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
            throw new StaticError(clause,
              'clause must be conditional if not last'
            )
          }
          first.eval();
          if (clause === first) {
            // set first clause as result during analysis
            this.result = first;
          } else if (
            // check type compatible with first clause
            !first.value!.updatableFrom(clause.value!)
          ) {
            throw new StaticError(clause, 'clauses must have same type result')
          } else if (this.getMaybe('^export') && !clause.getMaybe('^export')) {
            throw new StaticError(clause, 'all clauses must export')
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
            throw new StaticError(clause, 'exporting clause must be named')
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
              throw new StaticError(clause, 'all clauses must export')
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
        // set export choice
        this.export = this.containingItem.getMaybe('^export');
        if (this.export) {
          let choice = cast(this.export.value, Choice);
          choice.setChoice(this.fields.indexOf(clause))
          let option = choice.choice;
          option.detachValue();
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

  /** iterate through nested evaluated statements */
  *evaluatedStatements(): Generator<Statement> {
    if (this.workspace.analyzing) {
      yield* super.evaluatedStatements();
      return;
    }
    // when not analyzing yield only the executed clause
    for (let clause of this.statements) {
      if (!clause.rejected) {
        yield* clause.evaluatedStatements();
        return;
      }
    }
  }

}