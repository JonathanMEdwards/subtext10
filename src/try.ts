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

    // evaluate clauses until success
    for (let field of this.fields) {
      field.eval();
      if (this.workspace.analyzing) {
        if (
          !field.conditional && (
            this.conditional
            || field !== arrayLast(this.fields)
          )
        ) {
          throw new StaticError(
            field.id.token!,
            'try clause must be conditional if not last'
          )
        }
        let first = this.fields[0];
        if (field === first) {
          // set first clause as result during analysis
          this.result = first;
        } else if (
          // check type matches with first clause
          !field.value!.sameType(first.value!, first.path, field.path)
        ) {
          throw new StaticError(
            field.id.token!,
            'try clauses must have same type result'
          )
        }
      } else if (!field.rejected) {
        // stop on success when not analyzing
        this.result = field;
        break;
      }
      continue;
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