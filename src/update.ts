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

    // check target and type of writes
    this.statements.forEach(statement => {
      if (statement.formulaType !== 'write') return;
      let targetRef = cast(statement.get('^target').value, Reference);
      let target = targetRef.target!;
      const delta = statement.get('^delta');
      if (!target.value!.changeableFrom(delta.value!)) {
        throw new StaticError(statement, 'write changing type')
      }
      if (!target.comesBefore(delta)) {
        throw new StaticError(arrayLast(targetRef.tokens), 'write must go backwards')
      }
      if (!target.isInput && !target.isUpdatableOutput) {
        throw new StaticError(arrayLast(targetRef.tokens),
          'unwritable location');
        // note contextual writability of target is checked in replace
      }
    })
  }

}