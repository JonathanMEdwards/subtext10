import { Block, Field, assert, StaticError, Guard, Path, cast, Reference, Token, assertDefined, another, arrayLast, Crash, PendingValue, trap } from "./exports";

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

  /** initialize all values */
  initialize() {
    this.result = undefined;
    this.rejected = false;
    super.initialize();
  }

  copy(srcPath: Path, dstPath: Path): this {
    let to = super.copy(srcPath, dstPath);
    to.conditional = this.conditional;
    return to;
  }
}

/** A Do block is a procedure that evaluates statements sequentially */
export class Do extends Code {

}

/** A Call is a special Do block used to call a program. It contains a reference
 * to the program body followed by changes on the input arguments. The final
 * value is the program body modified with all supplied arguments. */
export class Call extends Do {

  /** whether call is asserting no rejections */
  get asserted(): boolean {
    return this.token!.text.endsWith('!');
  }

  /** Non-generic calls are short-circuited during analysis to allow
   * recursion. Only the inputs of the program are instantiated to analyze
   * arguments. The result is taken from the result of the definition.
  */
  eval() {
    if (!this.workspace.analyzing) {
      // execute argument assignments
      super.eval();
      if (!this.rejected) {
        // pull result out of final instance of code body
        let body = cast(arrayLast(this.fields).value, Code);
        body.eval();
        this.result = body.result;
        this.rejected = body.rejected;
        if (body.rejected && this.asserted) {
          throw new Crash(this.token, 'assertion failed')
        }
      }
      return;
    }

    // analyzing
    // first field is ref to program definition
    let first = this.fields[0];
    let ref = cast(first.get('^reference').value, Reference)
    ref.eval();
    first.conditional = ref.conditional;

    // detect if code body is conditional
    let def = cast(ref.target!.value, Code);
    if (def.conditional && !this.asserted) {
      this.conditional = true;
    }

    // If generic call can't short-circuit
    // FIXME: short-circuit from existing instances
    if (def.isGeneric) {
      // execute call normally except detect conditionality
      super.eval();
      let body = cast(arrayLast(this.fields).value, Code);
      body.eval();
      this.result = body.result;
      this.rejected = body.rejected;
      // detect conditional arguments
      this.fields.slice(2).forEach(arg => {
        if (arg.conditional) this.conditional = true;
      })
      return;
    }

    // copy just inputs of code
    let inputDefs = another(def);
    first.setValue(inputDefs);
    first.evalComplete = true;
    def.fields.forEach(field => {
      if (!field.isInput) return;
      // copy context is entire definition
      inputDefs.add(field.copy(def.containingItem.path, first.path))
    })

    // analyze argument assignments
    this.fields.slice(1).forEach(arg => {
      arg.eval();
      // detect if arguments might reject
      if (arg.conditional) this.conditional = true;
    })

    // use result of definition
    this.result = assertDefined(def.result);
  }

}