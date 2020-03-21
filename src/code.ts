import { Block, Field, assert, StaticError, Guard, Path, cast, Reference, Token, assertDefined, another, arrayLast, Crash, trap, arrayReverse, Value, Record, Item, Metafield } from "./exports";

/** A Code block is evaluated to produce a result value. The fields of the block
 * are called statements */
export class Code extends Block<Statement> {

  get statements(): Statement[] {
    return this.items;
  }

  /** field with result value. Undefined before eval and after rejection.
   * Defined after analysis regardless of rejection */
  result: Field | undefined;

  /** field with exported value. Defined when result is */
  export: Item | undefined;

  /** whether a field rejected */
  rejected = false;

  /** whether evaluation is conditional */
  conditional = false;

  eval() {
    if (this.result || this.rejected) {
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
      throw new StaticError(this.containingItem, 'code block has no result')
    }

    // evaluate statements until rejection
    for (let statement of this.statements) {
      statement.eval();
      if (statement.conditional) {
        if (statement.isInput) {
          throw new StaticError(statement, 'input fields must be unconditional')
        }
        this.conditional = true;
      }
      if (statement.rejected) {
        this.rejected = true
        // keep going during analysis
        if (this.workspace.analyzing) continue;
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
          throw new StaticError(ex, 'anonymous export statement must be unique')
        }
        const field = new Field;
        record.add(field);
        field.id = ex.id;
        field.isInput = true;
        this.fieldImport(field, ex);
      })
    }
  }


  /** define a field as a possibly recursive export */
  // FIXME: recursieve exports have turned out klugey. Redesign
  fieldImport(field: Field, ex: Item) {
    // detect recursive exports
    const exportType = ex.getMaybe('^exportType');
    let exportOrigin = ex.value!.origin.containingItem;
    if (
      exportOrigin instanceof Field
      && exportOrigin.id.name === '^export'
    ) {
      let originBase = exportOrigin.container.containingItem;
      if (
        originBase.path.containsOrEquals(this.containingItem.path)
        !== !!exportType
      ) {
        throw new StaticError(ex, 'recursive export must define reference');
      }
    }

    if (exportType) {
      // use supplied reference as type of export, needed for recursion
      // FIXME: infer from origin of exported value. Currently can only
      // detect recursion, not abstract it to clean reference
      field.formulaType = 'reference';
      field.copyMeta('^reference', exportType);
      field.copyValue(ex)

      // type check export
      if (this.workspace.analyzing) {
        this.workspace.exportAnalysisQueue.push(() => {
          let ref = cast(exportType.value, Reference);
          let target = assertDefined(ref.target);
          if (!target.value!.changeableFrom(ex.value!, ex.path, target.path)
          ) {
            throw new StaticError(ref.tokens[0], 'changing type of value')
          }
        })
      }
    } else {
      field.formulaType = 'none';
      field.copyValue(ex)
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

/** Statement is a field of a code block */
export class Statement extends Field {

  /** dataflow qualifier: check/let/export */
  dataflow?: 'let' | 'check' | 'export';

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
 * using the previous value */
export class Do extends Code {
  private _nominal: undefined;
}

/** A With block is a Do block that uses the previous value */
export class With extends Code {
  private _nominal: undefined;
}

/** A Call is a special Do block used to call a function. It contains a
 * reference to the function body followed by changes on the input arguments.
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
  eval() {
    if (!this.workspace.analyzing) {
      // execute argument assignments
      super.eval();
      if (!this.rejected) {
        // pull result out of final instance of code body
        let body = cast(arrayLast(this.fields).value, Code);
        body.eval();
        this.result = body.result;
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

    // If generic call can't short-circuit
    // FIXME: short-circuit from existing instances
    if (def.isGeneric) {
      // execute call normally except detect conditionality
      super.eval();
      let body = cast(arrayLast(this.fields).value, Code);
      body.eval();
      this.result = body.result;
      this.export = body.export;
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
    first.evaluated = true;
    def.fields.forEach(field => {
      if (!field.isInput) return;
      // copy context is entire definition
      inputDefs.add(field.copy(def.containingItem.path, first.path))
    })

    // analyze argument assignments
    this.statements.slice(1).forEach(arg => {
      arg.eval();
      // detect if arguments might reject
      if (arg.conditional) this.conditional = true;
    })

    // use result of definition
    this.result = assertDefined(def.result);
    this.export = def.export;
  }

  // suppress exporting
  evalExports() { }
}