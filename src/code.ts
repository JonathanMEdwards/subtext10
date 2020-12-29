import { Block, Field, assert, CompileError, Guard, Path, cast, Reference, Token, assertDefined, another, arrayLast, Crash, trap, arrayReverse, Value, Record, Item } from "./exports";

/** A Code block is evaluated to produce a result value. The fields of the block
 * are called statements */
export class Code extends Block<Statement> {

  get statements(): Statement[] {
    return this.items;
  }

  /** Statement with result value. Undefined before eval and after rejection.
   * Defined after analysis regardless of rejection */
  result: Statement | undefined;

  /** field with exported value. Defined when result is */
  export: Item | undefined;

  /** whether a field rejected */
  rejected = false;

  /** whether evaluation is conditional */
  conditional = false;

  /** Block can be updated from a call */
  get callIsUpdatable(): boolean {
    return this instanceof Updatable || !!this.onUpdateBlock;
  }

  /** on-update block at end else undefined */
  get onUpdateBlock(): OnUpdate | undefined {
    let block = arrayLast(this.statements).value;
    return block instanceof OnUpdate ? block : undefined
  }

  eval() {
    if (this.result) {
      return;
    }

    // set result as last statement, skipping backwards as needed
    // do this first to prevent deep value eval from recursing needlessly
    for (let statement of arrayReverse(this.statements)) {
      if (statement.dataflow) continue;
      statement.used = true;
      this.result = statement;
      break;
    }
    if (!this.result) {
      throw new CompileError(this.containingItem, 'code block has no result')
    }

    // evaluate statements until rejection
    let onUpdate = this.onUpdateBlock?.containingItem;
    for (let statement of this.statements) {
      statement.eval();

      // first statement error propagates to block
      if (statement !== onUpdate) this.propagateError(statement);

      if (statement.conditional) {
        if (statement.inputLike) {
          throw new CompileError(statement, 'input fields cannot be conditional')
        }
        this.conditional = true;
      }

      // FIXME do ? naming check in Item.eval()?
      if (statement.rejected) {
        this.rejected = true
        // execute to completion during analysis
        // can't complete in all cases because of recursion
        if (this.analyzing) {
          continue;
        }
        this.result = undefined
        break;
      }
    }

    // eval exports
    this.evalExports();
  }

  evalExports() {
    if (!this.result) return;
    let exports = this.statements.filter(
      statement => statement.dataflow === 'export'
    );
    if (exports.length === 0) {
      // re-export result
      this.export = this.result.getMaybe('^export');
    } else if (exports.length === 1 && exports[0].id.name === undefined) {
      // single anonymous export value
      this.export = exports[0];
    } else {
      // assemble record out of export statements
      let record = new Record;
      // Create as ^export on code block
      // Adds an extra copy, but simplifies the API
      let meta = this.containingItem.getMaybe('^export');
      if (meta) {
        meta.detachValue();
        meta.setValue(record);
      } else {
        meta = this.containingItem.setMeta('^export', record);
      }
      this.export = meta;
      exports.forEach(ex => {
        if (ex.id.name === undefined) {
          throw new CompileError(ex, 'anonymous export statement must be unique')
        }
        const field = new Field;
        record.add(field);
        field.id = ex.id;
        field.io = 'input';
        this.fieldImport(field, ex);
      })
    }
  }


  /** define a field as a possibly recursive export */
  // FIXME: recursive exports have turned out klugey. Redesign
  fieldImport(field: Field, ex: Item) {
    // detect recursive exports
    const exportType = ex.getMaybe('^exportType');
    let exportOrigin = ex.value!.origin.containingItem;
    if (
      exportOrigin instanceof Field
      && exportOrigin.id.name === '^export'
    ) {
      let originBase = exportOrigin.container.containingItem;
      if (originBase.containsOrEquals(this.containingItem) !== !!exportType) {
        throw new CompileError(ex, 'recursive export must define reference');
      }
    }

    if (exportType) {
      // use supplied reference as type of export, needed for recursion
      // FIXME: infer from origin of exported value. Currently can only
      // detect recursion, not abstract it to clean reference
      field.formulaType = 'reference';
      field.replaceMeta('^reference', exportType);
      field.copyValue(ex)

      // type check export
      if (this.analyzing) {
        this.workspace.exportAnalysisQueue.push(() => {
          let ref = cast(exportType.value, Reference);
          let target = assertDefined(ref.target);
          if (!target.value!.updatableFrom(ex.value!)
          ) {
            throw new CompileError(ref.tokens[0], 'changing type of value')
          }
        })
      }
    } else {
      field.formulaType = 'none';
      field.copyValue(ex)
    }
  }

  /** nested write statements */
  writeStatements(): Statement[] {
    let writes: Statement[] = [];
    for (let statement of this.statements) {
      if (!statement.evaluated) continue;
      writes.push(...statement.writeStatements());
      if (statement.formulaType === 'write') {
        writes.push(statement);
      }
    }
    return writes;
  }


  /** initialize all values */
  uneval() {
    this.result = undefined;
    this.rejected = false;
    super.uneval();
  }

  copy(srcPath: Path, dstPath: Path): this {
    let to = super.copy(srcPath, dstPath);
    to.conditional = this.conditional;
    return to;
  }
}

/** Statement is a field of a code block */
export class Statement extends Field {

  /** dataflow qualifier that passes previous value to next statement */
  dataflow?: 'let' | 'check' | 'export' | 'on-update';

  /** during analysis, whether field is used */
  used?: boolean;

  /** called on builtin statement to set exported value */
  exportFrom(value: string | number | Value) {
    let exportStatement = arrayLast(this.container.items);
    assert(exportStatement.dataflow === 'export');
    exportStatement.detachValue();
    exportStatement.setFrom(value);
  }

  /** called on conditional builtin statement to set whether accepted */
  setAccepted(accepted: boolean) {
    this.rejected = !accepted;
    this.setConditional(true);
  }

  get name() { return this.id.name }

  copy(srcPath: Path, dstPath: Path): this {
    let to = super.copy(srcPath, dstPath);
    to.dataflow = this.dataflow;
    return to;
  }
}

/** A Do block is a procedure that evaluates statements sequentially without
 * using the previous value. Currently only Do blocks are callable */
export class Do extends Code {
  private _nominal: undefined;
}

/** A Do block whose calls can execute in reverse on update.
 * Cannot be recursive */
export class Updatable extends Do {
  private _nominal2: undefined;
}

/** A With block is a Do block that uses the previous value */
export class With extends Code {
  private _nominal: undefined;
}

/** A Call is a special Do block used to call a function. It contains a
 * reference to the function body followed by updates on the input arguments.
 * The final value is the function body modified with all supplied arguments. */
export class Call extends Code {

  /** whether call is asserting no rejections */
  get asserted(): boolean {
    return this.token!.text.endsWith('!');
  }

  /** Non-generic calls are short-circuited during analysis to allow
   * recursion. Only the inputs of the function are instantiated to analyze
   * arguments. The result is taken from the result of the definition.
  */
  // Note edit errors in arguments are strictly passed to result.
  // Perhaps want to lazily pass through errors
  eval() {
    if (!this.analyzing) {
      // execute argument assignments
      super.eval();
      if (!this.rejected) {
        // pull result out of final instance of code body
        let body = cast(arrayLast(this.statements).value, Code);
        body.eval();
        this.result = body.result;
        if (body.result) this.propagateError(body.result);
        this.export = body.export;
        this.rejected = body.rejected;
        if (body.rejected && this.asserted) {
          throw new Crash(this.token, 'assertion failed')
        }
      }
      return;
    }

    // analyzing
    // first statement is ref to function definition
    let first = this.statements[0];
    let ref = cast(first.get('^reference').value, Reference)
    ref.eval();
    first.conditional = ref.conditional;

    // detect if code body is conditional
    let def = cast(ref.target!.value, Code);
    if (def.conditional && !this.asserted) {
      this.conditional = true;
    }

    // If generic or updatable call can't short-circuit, so can't recurse
    if (def.isGeneric || def.callIsUpdatable) {
      // execute call normally except detect conditionality
      super.eval();
      let body = cast(arrayLast(this.fields).value, Code);
      body.eval();
      this.result = body.result;
      this.export = body.export;
      this.rejected = body.rejected;
      // detect conditional arguments
      this.statements.slice(2).forEach(arg => {
        if (arg.io === 'input' && arg.conditional) this.conditional = true;
      })
      return;
    }

    // copy just inputs of code
    let inputDefs = another(def);
    first.setValue(inputDefs);
    first.evaluated = true;
    def.fields.forEach(field => {
      if (field.io !== 'input') return;
      // copy context is entire definition
      inputDefs.add(field.copy(def.containingPath, first.path))
    })

    // analyze argument assignments
    this.statements.slice(1).forEach(arg => {
      arg.eval();
      // detect if arguments might reject
      if (arg.conditional) this.conditional = true;
    })

    // use result of definition
    this.result = assertDefined(def.result);
    this.propagateError(def.result!);
    this.export = def.export;
  }

  // suppress exporting
  evalExports() { }
}

/** update reaction blocks */
export class OnUpdate extends Code {

  eval() {

    super.eval();

    // analyze update
    if (!this.analyzing) return;
    let container = this.containingItem.container;
    if (
      !(container instanceof Code)
      || arrayLast(container.statements).value !== this
    ) {
      throw new CompileError(this.containingItem,
        'on-update must be last statement of code block')
    }
    if (this.conditional) {
      throw new CompileError(this.containingItem,
        'on-update cannot be conditional')
    }
    // generated input doesn't need to be used
    let input = this.statements[0];
    input.used = true;
    // TODO type check user-defined input

    // force resolve() conditionals
    for (let item of this.containingItem.visit()) {
      item.resolve();
    }
  }

}