import { Do, StaticError, arrayLast, Crash, Field } from "./exports";

/** a try block is the basic control structure of Subtext. It contains a sequnce
 * of do-blocks called clauses. The clauses are executed in order until one does
 * not reject */
export class Try extends Do {

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
      // later to allow recursion
      let first = this.fields[0];
      for (let field of this.fields) {
        /** function to analyze clause */
        const analyzeClause = () => {
          field.eval();
          if (
            !field.conditional && (
              this.conditional
              || field !== arrayLast(this.fields)
            )
          ) {
            throw new StaticError(
              field,
              'try clause must be conditional if not last'
            )
          }
          if (field === first) {
            // set first clause as result during analysis
            this.result = first;
          } else if (
            // check type compatible with first clause
            !first.value!.changeableFrom(field.value!, field.path, first.path)
          ) {
            throw new StaticError(
              field,
              'try clauses must have same type result'
            )
          }
        }
        if (field === first) {
          // immediately analyze first clause, setting result type
          analyzeClause();
        } else {
          // defer non-first clauses so they can make recursive calls
          this.workspace.analysisQueue.push(analyzeClause);
        }
        continue;
      }
      return;
    }

    // at runtime evaluate clauses until success
    for (let field of this.fields) {
      field.eval();
      if (!field.rejected) {
        // stop on success when not analyzing
        this.result = field;
        break;
      }
    }

    // reject or crash on fall-through
    if (!this.result) {
      if (this.conditional) {
        this.rejected = true;
      } else {
        throw new Crash(arrayLast(this.fields).id.token!, 'try failed')
      }
    }
  }
}