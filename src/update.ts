import { Code, StaticError, arrayLast, cast, Reference } from "./exports";

/** update reaction blocks */
export class Update extends Code {

  // only evaluate during analysis, leaving initialized for updates
  eval() {
    if (!this.workspace.analyzing) return

    super.eval();

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
        throw new StaticError(targetRef.tokens[0], 'write must go backwards')
      }
    })

  }

}