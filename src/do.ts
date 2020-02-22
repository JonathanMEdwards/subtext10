import { Block, arrayLast, Field, assert, StaticError, Guard, Path, cast, Reference } from "./exports";

/** A Code block is evaluated to produce a result value. The fields of the block
 * are called statements */
export class Code extends Block {

  /** field with result value. Undefined before eval and after rejection.
   * Defined after analysis regardless of rejection */
  result: Field | undefined;

  /** whether a field rejected */
  rejected = false;

  /** whether evaluation is conditional */
  conditional = false;

  eval() {
    if (this.result || this.rejected) {
      return;
    }

    // evaluate fields until rejection
    for (let field of this.fields) {
      field.eval();
      if (field.conditional) {
        if (field.isInput) {
          throw new StaticError(
            field.id.token!,
            'input fields must be unconditional'
          )
        }
        this.conditional = true;
      }
      if (field.rejected) {
        this.rejected = true
        if (!this.workspace.analyzing) {
          // stop execution unless analyzing
          this.result = undefined;
          break;
        }
      }
      // TODO: skip let/check statements
      this.result = field;
    }
  }

  /** reset to initially defined state */
  reset() {
    this.result = undefined;
    this.rejected = false;
    super.reset();
  }
}

/** A Do block is a procedure that evaluates statements sequentially */
export class Do extends Code {

}

/** A Call is a special Do block that calls get compiled into */
export class Call extends Do {
  /** token naming program */
  get token() {
    // reference in first field
    let ref = cast(this.fields[0].get('^reference').value, Reference);
    // name of program
    return ref.tokens[ref.tokens.length - 2];
  }

  /** whether call is asserting no rejections */
  get asserted() {
    return this.token.text.endsWith('!');
  }
}