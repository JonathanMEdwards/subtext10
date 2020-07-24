import { Code, StaticError, arrayLast, cast, Reference } from "./exports";

/** update reaction blocks */
export class Update extends Code {

  // note only called from containing eval during analysis
  eval() {

    super.eval();

    // analyze update
    if (!this.workspace.analyzing) return;
    let container = this.containingItem.container;
    if (
      !(container instanceof Code)
      || arrayLast(container.statements).value !== this
    ) {
      throw new StaticError(this.containingItem,
        'update must be last statement of code block')
    }
    if (this.conditional) {
      throw new StaticError(this.containingItem,
        'update cannot be conditional')
    }
    // generated input doesn't need to be used
    let input = this.statements[0];
    input.used = true;
    // TODO type check user-defined input
  }

}