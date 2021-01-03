import { Workspace, ID, Path, Container, Value, RealID, Metadata, MetaID, isString, another, Field, Reference, trap, assert, Code, Token, cast, arrayLast, Call, Text, evalBuiltin, Try, assertDefined, builtinWorkspace, Statement, Choice, Selection, Metafield, _Number, Loop, OptionReference, OnUpdate, updateBuiltin, Do, DeltaContainer, arrayReverse, _Array, arrayRemove, Entry, Record, Link, FieldID, Version, Block, Nil, Base, Character} from "./exports";
/**
 * An Item contains a Value. A Value may be a Container of other items. Values
 * that do not contain Items are Base values. This forms a tree, where Values
 * are the nodes and Items are the edges. The top Item is a Workspace. Each
 * contained item carries an ID, and we identify items by the path of IDs down
 * from the top.
 */

export abstract class Item<I extends RealID = RealID, V extends Value = Value> {

  /** Physical container */
  container!: Container<this>;

  /** memoized Version */
  _version?: Version;
  get version(): Version {
    if (!this._version) {
      this._version = this.container.version;
    }
    return this._version;
  }
  get workspace(): Workspace {
    return this.version.container.containingItem as Workspace
  }

  /** whether workspace is analyzing */
  get analyzing() { return this.workspace.analyzing; }

  /** ID of the item within its container */
  id!: I;

  /** memoized Path */
  _path?: Path;
  get path(): Path {
    if (!this._path) {
      this._path = this.container.containingPath.down(this.id);
    }
    return this._path
  }
  // FIXME: report ordinals on anon fields, not serials
  get pathString() { return this.path.toString(); }


  /** whether this item contains another */
  contains(other: Item): boolean {
    return this.path.contains(other.path);
  }
  /** whether this item contains or equals another based on paths */
  containsOrEquals(other: Item): boolean {
    return this.path.containsOrEquals(other.path);
  }

  /** whether this item is in an array template */
  //get inTemplate() { return this.path.ids.includes(0) }

  /** Logical container: metadata is physically contained in base item, but
   * logically is a peer */
  get up(): Item {
    return this.container!.up;
  }

  /** iterate upwards through logical containers to Version */
  *upwards(): Generator<Item> {
    for (
      let item: Item = this.up;
      !(item instanceof Workspace);
      item = item.up
    ) {
      yield item;
    }
  }

  /** iterate upwards starting with this */
  *thisUpwards(): Generator<Item> {
    yield this;
    yield* this.upwards();
  }

  /** top-down iteration through all items */
  *visit(): IterableIterator<Item> {
    if (this.metadata) {
      yield* this.metadata.visit();
    }
    yield this;
    if (this.value instanceof Container) {
      yield* this.value.visit()
    }
  }

  /** top-down iteration through all non-metadata items */
  *visitBase(): IterableIterator<Item> {
    yield this;
    if (this.value instanceof Container) {
      for (let item of this.value.items) {
        yield* item.visitBase();
      }
    }
  }

  /** Metadata block. Undefined if no metadata */
  metadata?: Metadata;

  /** the Item at a downward path else trap. Accepts a dotted string or ID[] */
  down(path: Path | ID[] | string): Item {
    if (path === '') return this;
    let ids = (
      path instanceof Path
        ? path.ids
        : typeof path === 'string'
          ? path.split('.')
          : path
    )
    let target: Item = this;
    ids.forEach(id => {
      target = target.get(id);
    });
    return target;
  }

  /** The item at a downward path else undefined */
  downMaybe(ids: ID[]): Item | undefined {
    let target: Item | undefined = this;
    for (let id of ids) {
      target = target.getMaybe(id);
      if (!target) return undefined;
    }
    return target;
  }

  /** the contained item with an ID else trap */
  get(id: ID): Item {
    return this.getMaybe(id) ?? trap(this.path + ': ' + id + ' undefined');
  }

  /** the contained item with an ID else undefined */
  getMaybe(id: ID): Item | undefined {
    if (
      id instanceof MetaID
      || (isString(id) && id.startsWith('^'))
    ) {
      // metadata access
      if (id === '^delta' || id === MetaID.ids['^delta']) {
        return this.deltaField;
      }
      let metafield = this.metadata?.getMaybe(id);
      if (metafield) return metafield;
      if (id === '^initial' || id === MetaID.ids['^initial']) {
        // FIXME
        // synthesize ^initial metadata to access initial value of an input
        // copy base item into ^initial
        // currently only used on options
        assert(this.inputLike);
        this.resolve();
        let copy = this.copy(this.path, this.path.down(MetaID.ids['^initial']));
        let initial = this.setMeta('^initial');
        // transfer copy into metafield
        initial.formulaType = copy.formulaType;
        initial.io = 'output';
        if (copy.metadata) {
          initial.metadata = copy.metadata;
          initial.metadata.containingItem = initial;
        }
        if (copy.formulaType === 'none') {
          let value = assertDefined(copy.value);
          copy.detachValue();
          initial.setValue(value);
        }
        return initial;
      }
      return undefined;
    }

    // evaluate and get from value
    return this.value?.getMaybe(id);
  }

  /** set a metadata field by name. Must not already exist. Value must be
   * detached or undefined */
  setMeta(name: string, value?: Value): Metafield {
    if (!this.metadata) {
      // allocate metadata block
      this.metadata = new Metadata;
      this.metadata.containingItem = this;
    }
    return this.metadata.set(name, value);
  }

  /** create or replace metadata with copy of value of item. Can also supply a
   * value or string or number */
  replaceMeta(name: string, value: Item | Value | string | number): Metafield {
    let meta = this.getMaybe(name) as Metafield;
    if (meta) {
      meta.detachValue();
    } else {
      meta = this.setMeta(name);
    }
    meta.setFrom(value);
    return meta;
  }

  /** wether this item is in metadata of a Version, meaning it is a formula
   * in History
   */
  get inHistoryFormula() {
    return this.path.ids[1] instanceof MetaID;
  }

/* ------------------------------- evaluation ------------------------------- */


  /**
   * How value is computed. The formula is stored in various metadata fields
   * depending on this tag.
   *
   * FIXME: this sould be encoded as metadata using standard datatypes.
   * formulaType should become a Choice. Optionality should be made explicit.
   *
   * none: value is in item.value. Used for literal outputs and data
   *
   * instance: data with type referenced in ^reference
   *
   * literal: value is in ^literal
   *
   * reference: value is target of a Reference in ^reference
   *
   * code: value is result of a Code block in ^code
   *
   * loop: value is result of a Loop block in ^loop
   *
   * extend: extension in ^extend, ^reference refers to `that`
   *
   * update: dependent reference in ^target, formula in ^payload
   *
   * updateInput: special update used for input of a call
   *
   * write: formula in ^writeValue or ^payload, structural reference in ^target
   *
   * choose: OptionReference in ^target, optional formula in ^payload
   *
   * call: Call block in ^call, starting with reference to function followed by
   * updates on the arguments
   *
   * include: currently includes only builtins
   *
   * builtin: ^builtin contains name of builtin as a Text value
   *
   * ***********************************************************************
   * Edit operations start with :: and have a dependent reference in ^target
   *
   * ::replace,
   * literal or relative reference in ^source
   *
   *
   *  */
  formulaType: (
    'none' | 'literal' | 'reference' | 'code' | 'update' | 'updateInput'
    | 'write' | 'choose' | 'call' | 'include' | 'builtin' | 'loop' | 'extend'
    | '::replace' | '::insert' | '::append' | '::convert'
  ) = 'none';

  /** IO mode of item. Inputs are mutable state and function parameters. Outputs
   * are read-only formulas. Interfaces are updatable formulas. Registers are
   * inputs in code whose value is retained across updates
   *
   * input is migrating to data, and output to result.
   * function parameters are currently inputs, but will become results
   * data will be denoted with `::` during migration
   * */
  io: 'data' | 'input' | 'output' | 'interface' | 'register' = 'output';

  /** whether an input or register */
  get inputLike() {
    return this.io === 'input' || this.io === 'data' || this.io === 'register';
  }

  /** whether input or data */
  get dataLike() {
    return this.io === 'input' || this.io === 'data';
  }

  /** whether value should be rederived on copies */
  // FIXME: change literal outputs to be constant data?
  get isDerived() {
    return !this.inputLike && this.formulaType !== 'none'
  }

  /** error caused by editing. String literal indicates kind of error in
   * non-derived items. Pointer to Item containing error for a derived item.
   *
   * There will still be a defined value even when there is an error. Copied on
   * non-derived items  */
  // TODO: array of multiple Items with errors
  editError: undefined | Item | 'conversion' | 'type' | 'reference';

  /** propagate error from another Item or its Value. Does nothing if already an error */
  propagateError(from: Item | Value ) {
    if (this.editError) {
      // already an error
      return;
    }
    if (from instanceof Value) {
      // use contianing item of value
      from = from.containingItem;
    }
    if (from.editError) {
      // link to error source
      this.editError = from;
    }
  }

  /** track down derived errors */
  get originalEditError(): undefined | string {
    if (this.editError instanceof Item) {
      return this.editError.originalEditError;
    }
    return this.editError;
  }

  /** whether item can reject having a value. Determined during analysis */
  conditional = false;

  setConditional(b?: boolean) {
    if (!b) return;
    if (this.analyzing) {
      this.conditional = true;
    } else {
      assert(this.conditional);
    }
  }

  /** Evaluation rejected. Not copied */
  rejected = false;

  /** value of item. Undefined when not yet derived from formula or rejected.
   * Copied on non-derived items  */
  value?: V;

  /** false before evaluated, undefined during evaluation, true afterwards */
  evaluated: boolean | undefined = false;

  /** thunk for deferred analysis of item. Used to break recursive dependencies.
   * this.evaluated should be set undefined */
  deferral?: () => void;

  /** resolve deferral, leaving item evaluated */
  resolve() {
    let deferral = this.deferral;
    if (!deferral) return;
    assert(!this.isDetached() && this.analyzing)
    // set item unevaluated, with deferral to catch cycles
    this.evaluated = false;
    this.deferral = () => {
      throw new CompileError(this, 'circular dependency')
    }
    // execute thunk
    deferral();
    // item should have been evaluated
    assert(this.evaluated);
    this.deferral = undefined;
  }

  /** max depth of items */
  static readonly DepthLimit = 100;

  /** Evaluate metadata and value */
  eval() {
    // skip if pending
    if (this.evaluated === undefined) return
    if (this.value) {
      if (this.evaluated) return;
      assert(!this.isDerived);
      // set evaluation pending
      this.evaluated = undefined;
      // evaluate metadata then contents
      this.metadata?.eval();
    } else if (this.rejected) {
      assert(this.evaluated);
      return;
    } else {

      // derive value
      // set evaluation pending
      assert(!this.evaluated);
      this.evaluated = undefined;

      if (this.path.length > Item.DepthLimit) {
        throw new Crash(this.container.token!, 'Workspace too deep')
      }

      if (this.formulaType === 'extend') {
        this.extend()
      }

      // evaluate metadata
      this.metadata?.eval();

      // evaluate formula
      switch (this.formulaType) {

        case 'literal':
          this.copyValue(this.get('^literal'));
          break;

        case 'reference':
          let ref = cast(this.get('^reference').value, Reference);
          this.setConditional(ref.conditional);
          this.rejected = ref.rejected;
          this.propagateError(ref.containingItem); // ref error
          if (ref.target) {
            this.propagateError(ref.target); // error on target
            this.copyValue(ref.target);
          } else {
            // set Nil value for dangling reference
            assert(ref.containingItem.originalEditError === 'reference');
            this.setValue(new Nil);
          }
          break;

        case 'code':
          this.result(cast(this.get('^code').value, Code));
          break;

        case 'loop':
          let loop = cast(this.get('^loop').value, Loop);
          loop.execute(cast(this, Statement));
          break;

        case 'call':
          this.result(cast(this.get('^call').value, Call));
          break;

        case 'update':
        case 'updateInput':
          this.update();
          break;

        case 'choose':
          this.choose();
          break;

        case 'write':
          assert(this instanceof Statement);
          const writeValue =
            this.getMaybe('^writeValue') || this.get('^payload');
          let targetRef = cast(this.get('^target').value, Reference);
          let target = assertDefined(targetRef.target);
          if (this.analyzing) {
            // must be inside an on-update block
            for (let up of this.upwards()) {
              if (up.value instanceof OnUpdate) break;
              if (up instanceof Workspace) {
                throw new CompileError(this, 'write must be in on-update block');
              }
            }
            // check target and type of writes
            if (!target.comesBefore(writeValue)) {
              throw new CompileError(arrayLast(targetRef.tokens), 'write must go backwards')
            }
            if (target.io === 'output') {
              throw new CompileError(arrayLast(targetRef.tokens),
                'not updatable');
              // note contextual writability of target is checked in update
            }
          }

          if (!target.value!.updatableFrom(writeValue.value!)) {
            // type error - will infect triggering update operation
            // throw new StaticError(this, 'write changing type')
            this.editError = 'type';
          }

          // write is actually performed in triggering update operation
          // target and writeValue in metadata already evaluated
          // copy value of writeValue
          this.copyValue(writeValue);
          this.used = true;
          break;

        case 'include':
          this.copyValue(builtinWorkspace.currentVersion);
          break;

        case 'builtin':
          evalBuiltin(cast(this, Statement));
          break;

        case 'extend':
          // already evaluated
          break;

        case '::replace':
        case '::insert':
        case '::append':
        case '::convert':
          // edits
          this.edit();
          break;

        default:
          trap();
      }
    }

    // override register value from update input
    if (this.io === 'register') {
      // find containing update result
      // will be Version for top-level formulas
      for (let update of this.upwards()) {
        if (update.formulaType !== 'update') continue;

        // input of update is context of ^target reference
        const ref = cast(update.get('^target').value, Reference);
        const context = this.workspace.down(ref.path.ids.slice(0, ref.context));
        // register at same path within input
        const inputRegister =
          context.downMaybe(this.path.ids.slice(update.path.ids.length));
        if (!inputRegister) {
          // register doesn't exist in input
          break;
        }
        // if input register was written during update, use that value
        let delta = inputRegister.deltaField ?? inputRegister;

        // update register with proper contextual copying
        update.updateValue(context, this, delta);
        break;
      }
    }


    // evaluate value contents deeply
    // Don't do this on the function bodies in a Call
    // or on-update blocks post analysis
    // FIXME: this looks like a huge mistake
    // Should have separated shallow and deep evaluation
    // maybe causes some of the needs for deferred evaluation
    // evalIfNeeded was another workaround
    if (this.value
      && !(this.container instanceof Call)
      && !(this.value instanceof OnUpdate && !this.analyzing)) {
      this.value.eval();
    }

    this.evaluated = true;
  }

  /** all nested write statements */
  writeStatements(): Statement[] {
    switch (this.formulaType) {
      case 'code':
        return cast(this.get('^code').value, Code).writeStatements();

      case 'loop':
        let loop = cast(this.get('^loop').value, Loop);
        trap(); // FIXME
        break;

      case 'call':
        let writes: Statement[] = [];
        let call = cast(this.get('^call').value, Call);
        for (let arg of call.statements.slice(1)) {
          writes.push(...arg.writeStatements());
        }
        const body = arrayLast(call.statements).value;
        writes.push(...cast(body, Do).writeStatements());
        return writes;

      case 'update':
      case 'updateInput':
      case 'choose':
        let payload = this.getMaybe('^payload');
        if (payload) {
          return payload.writeStatements();
        }
        return [];

      case 'write':
        const writeValue = this.getMaybe('^writeValue') || this.get('^payload');
        return writeValue.writeStatements();

      default:
        return [];
    }
  }

  /** get result of code or call */
  private result(code: Code) {
    this.setConditional(code.conditional);
    this.rejected = code.rejected;
    this.propagateError(code);
    this.copyValue(code.result);

    if (code.export) {
      let exportField = this.replaceMeta('^export', code.export);
      exportField.setConditional(code.conditional);
      exportField.rejected = code.rejected;
    } else {
      let exportField = this.getMaybe('^export');
      if (exportField) {
        // runtime rejection of export
        assert(code.rejected);
        exportField.rejected = true;
        exportField.detachValue();
      }
    }
  }

  /** whether this item uses the value of the previous item */
  usesPrevious = false;

  /** The previous item in evaluation order. Used by dependent references. */
  previous(): Item | undefined {
    // should only be used during analysis to bind references
    // because if previous value is in outer container, copies of this item need
    // to capture the reference
    assert(this.analyzing || this.inHistoryFormula);
    this.usesPrevious = true;
    let container = this.container;
    let itemIndex = container.items.indexOf(this);
    assert(itemIndex >= 0);
    if (
      !itemIndex
      || container instanceof Metadata
      || container instanceof Try
    ) {
      // At beginning of container, or in metadata/try
      // Use previous in grand-container. Scan stops in Version
      return container.containingItem.previous();
    }
    // previous item in container, skipping certain statements
    while (itemIndex) {
      let prev = container.items[--itemIndex]
      if (prev instanceof Statement && prev.dataflow) continue;
      // also skip includes
      if (prev.formulaType === 'include') continue;
      return prev;
    }
    // skip to container
    return container.containingItem.previous();
  }

  private choose() {
    // target and payload in metadata already evaluated
    const ref = cast(this.get('^target').value, Reference);
    assert(ref instanceof OptionReference);
    // copy source choice to our value
    this.copyValue(ref.target)
    let choice = cast(this.value, Choice);
    // set choice
    let option = choice.setChoice(choice.items.findIndex(
      option => option.id === ref.optionID));
    // resolve deferred analysis of the option
    option.resolve();

    // set option from payload
    const payload = this.getMaybe('^payload');
    if (payload) {
      this.setConditional(payload.conditional);
      if (payload.rejected) this.rejected = true;
      assert(payload.value);
      // replace target value with payload value
      option.eval();
      if (!option.value!.updatableFrom(payload.value!)) {
        throw new CompileError(arrayLast(ref.tokens), 'changing type of value')
      }
      option.detachValue();
      option.copyValue(payload);
    }
  }


  /** evaluate a record extension */
  private extend() {
    let extending = cast(this.get('^extend').value, Record);
    let ref = cast(this.get('^reference').value, Reference);
    if (this.analyzing && !ref.target) {
      // first binding
      ref.eval();
      // inject source fields into record for proper lexical binding
      let source = ref.target!.value;
      if (!(source instanceof Record)) {
        throw new CompileError(this, 'extend requires a record');
      }
      for (let field of arrayReverse(source.fields)) {
        // copy in context of record
        let copy = field.copy(
          source.containingPath, extending.containingPath);
        extending.fields.splice(0, 0, copy)
        copy.container = extending;
      }
      // bind extension
      extending.eval()
    } else {
      ref.eval();
    }
    // copy source record into value
    this.copyValue(ref.target);
    let value = cast(this.value, Record);
    // append extended fields into value
    for (let i = value.fields.length; i < extending.fields.length; i++) {
      let field = extending.fields[i];
      // copy with record context
      let copy = field.copy(extending.containingPath, this.path);
      value.fields.push(copy);
      copy.container = value;
    }
  }

/* --------------------------------- update --------------------------------- */

  /** Determines if a contained item is writable in the context of an update on
   * self. An item will be writable if it is an input field, and its containers
   * are also input fields all the way up to this context. In this case the item
   * itself is returned.
   *
   * An item is also writable if it is inputs all the way up to a container
   * which is a "write sink" that will divert the write elsewhere. Write sinks
   * are interfaces, code statements, registers, and ^payload fields. In this
   * case the containing sink item is returned.
   *
   * Returns undefined if the item is not writable
   * */
  writeSink(item: Item): Item | undefined {
    // scan upwards to this
    for (let up = item; up !== this; up = up.container.containingItem) {
      // interface is a sink
      if (up.io === 'interface') return up;
      // register is a sink
      if (up.io === 'register') return up;
      // Code block statement can be a sink (for reverse execution)
      if (up instanceof Statement) return up;
      // can write into payload of `:=`
      // FIXME maybe require`:=|>` to be writable
      if (up.id === MetaID.ids['^payload']) return up;
      if (!up.inputLike) return undefined;
    }
    // Inputs all the way up so can write to original item
    return item;
  }


  /** Optional container for a ^delta value set during update. Kept out of
   * metadata so as to not affect value semantics. Not copied.
   */
  delta?: DeltaContainer;
  get deltaField(): Metafield | undefined {
    return this.delta?.deltaField
  }
  /** set or replace delta value */
  setDelta(from?: Item): Metafield {
    if (!this.delta) {
      // allocate delta container
      this.delta = new DeltaContainer;
      this.delta.containingItem = this;
      let deltaField = new Metafield;
      this.delta.add(deltaField);
      deltaField.id = MetaID.ids['^delta'];
      deltaField.formulaType = 'none';
      deltaField.io = 'input'
    }
    let deltaField = this.delta.deltaField;
    deltaField.detachValueIf();
    if (from) {
      deltaField.setFrom(from);
    }
    return deltaField;
  }



  /** evaluate update operation
   *
   * Output updates are handled by explicit on-update blocks and
   * implicit reverse execution of code blocks. These are executed in strict
   * backwards tree order. Updates propagate backwards in the context value
   * until they all ground out in input fields.
   *
   * Updates are executed within the input context value, stored in ^delta
   * metdata, and tracked in the array pendingDeltas. Updates grounding out in
   * input fields get written into the copy of the context in value of this
   * field.
   */

  private update() {
    // target and payload in metadata already evaluated
    const ref = cast(this.get('^target').value, Reference);
    assert(ref.dependent);
    // get previous value, which is context of reference
    this.setConditional(ref.conditional);
    if (ref.rejected) {
      // target reference rejected
      this.rejected = true;
      if (!this.analyzing) return;
    }
    const target = ref.target;
    assert(target);
    const context = this.workspace.down(ref.path.ids.slice(0, ref.context));
    // replace needs to be within context
    assert(target !== context);
    context.eval();

    // Set ^delta on target to changed value
    const payload = this.get('^payload');
    assert(payload.value);
    this.setConditional(payload.conditional);
    if (payload.rejected) this.rejected = true;

    // replace target value with payload value
    if (!target.value!.updatableFrom(payload.value!)) {
      // type error
      this.editError = 'type';
      // pass through context unchanged
      this.detachValueIf();
      this.copyValue(context);
      return;
    }

    target.setDelta(payload);
    this.propagateError(payload);

    // propagate updates within context
    let groundedWrites =
      (this.container instanceof Call)
        // don't propagate function argument assignments
        ? [target]
        : this.feedback(context, ...context.writeSelection(target));


    // replace grounded deltas in result copied from context
    this.detachValueIf();
    this.copyValue(context);

    if (this.editError) {
      // leave value unchanged on error
      return;
    }

    for (let write of groundedWrites) {
      if (write.io === 'register') {
        // register updates are left in the ^delta of input, to be accessed
        // when the register is evaluated in the result
        return;
      }
      // set value at path within context
      let target = this.down(write.path.ids.slice(ref.context));
      this.updateValue(context, target, assertDefined(write.deltaField));
    }

    if (this.formulaType === 'updateInput') {
      // initialize call body to recalc arg defaults from input value,
      // preserving primary input value
      // FIXME: maybe compile this into an explicit initialize operation?
      // But don't want to init primary input.
      cast(this.value, Code).statements.slice(1).forEach(statement =>
        statement.uneval())
    }

  }

  /** Update a value within the result of an update operation. References within
   * the context are mapped */
  private updateValue(context: Item, target: Item, delta: Item) {
    target.detachValue();
    target.copyValue(delta);
    // clear error on target
    target.editError = undefined;

    // translate references from inside value to context
    // Note this wouldn't be necessary if we only copied over input values
    const translate = (value?: Value) => {
      if (value instanceof Reference && context.path.contains(value.path)) {
        value.path = value.path.translate(context.path, this.path);
      }
    };
    if (target.value instanceof Container) {
      for (let item of target.value.visit()) {
        translate(item.value);
      }
    } else {
      translate(target.value);
    }
  }

  /**
   * Write possibly forwarded through a selection. Selection writes are
   * forwarded immediately because they can go backwards, which is OK so long as
   * not going backwards from writing location
   *
   * @param this bounding context
   * @param write item to write, ^delta containing value to write
   * @param from optional backstop on backwards write
   * @returns array of items to write with ^delta set
   */
  writeSelection(write: Item, from?: Item): Item[] {
    const link = write.value;
    if (!(link instanceof Link) || link.primary) {
      // not a secondary link change

      // forward through containing synthetic selection field into backing array
      for (
        let selectionField = write;
        selectionField !== this;
        selectionField = selectionField.container.containingItem
      ) {
        let selection = selectionField.container;
        if (selection instanceof Selection) {
          // synthetic selection field - forward to backing array
          switch (selectionField.id) {
            case FieldID.predefined.at:
            case FieldID.predefined.backing:
            case FieldID.predefined.selections:
              if (selectionField === write && selectionField.id === FieldID.predefined.selections) {
                // writing whole selected array
                // must merge with backing array, detecting inserts and deletes
                trap();
              }
              // target is inside backing array at corresponding path
              let backingItem = selection.backing.containingItem;
              if (selectionField.id === FieldID.predefined.at) {
                // target selected item
                let id = this.analyzing ? 0 : selection.selected[0];
                backingItem = backingItem.get(id);
              }
              if (!this.contains(backingItem)) {
                // write leaving feedback context
                throw new CompileError(write, 'write outside context of update')
              }
              let target = backingItem.down(write.path.ids.slice(selectionField.path.length));
              if (from && from.comesBefore(backingItem)) {
                throw new CompileError(write, 'write to link goes forwards');
              }
              target.setDelta(write.deltaField);
              return [target];
          }
          continue;
        }
      }

      // pass through write
      return [write];
    }

    // write to secondary link updates primary links
    if (!link.atHome) {
      // only allow update within the defining array
      // FIXME: possibly could allow updates to flow backwards through copies
      // FIXME: could stage update - home table update would scan for internal
      // staged changes.
      // Still need table context to propagate uniqueness changes
      throw new CompileError(write, 'writing secondary link outside home table');
    }
    const backing = link.backing;
    if (!this.contains(backing.containingItem)) {
      // write leaving feedback context
      throw new CompileError(write, 'write outside context of update')
    }
    if (from && from.comesBefore(backing.containingItem)) {
      throw new CompileError(write, 'write to link goes forwards');
    }

    if (this.analyzing) {
      // in analysis write the opposite template link
      let oppositeField = backing.template.get(link.oppositeFieldID);
      let oppositeDelta = oppositeField.setDelta(oppositeField);
      oppositeDelta.uncopy();
      return [oppositeField];
    }

    let writes: Item[] = [];
    const row = write.container.containingItem as Entry;
    let oldSelected = link.selected;
    let newSelected = cast(write.deltaField!.value, Link).selected;

    // add new selections
    newSelected.forEach(id => {
      if (oldSelected.includes(id)) {
        return
      }
      // write link with addition of this ID
      let oppositeField = backing.get(id).get(link.oppositeFieldID);
      let oppositeDelta = oppositeField.setDelta(oppositeField);
      cast(oppositeDelta.value, Link).select(row.id);
      writes.push(oppositeField);
    })

    // remove old selections
    oldSelected.forEach(id => {
      if (newSelected.includes(id)) {
        return
      }
      // write link with addition of this ID
      let oppositeField = backing.get(id).get(link.oppositeFieldID);
      let oppositeDelta = oppositeField.setDelta(oppositeField);
      cast(oppositeDelta.value, Link).deselect(row.id);
      writes.push(oppositeField);
    })

    // note writes may be out of order within array, but that is OK
    return writes;
  }

  /** Feedback propagates writes in reverse tree order until all grounded at
   * inputs. Propagates errors to this.editError
   *
   * @param context bounding context of update
   * @param writes initial written fields with value in their ^delta
   * @returns array of grounded writes */
  feedback(context: Item, ...writes: Item[] ): Item[] {

    // stack of pending writes, sorted in tree order
    let pendingWrites = writes.slice();
    // result array of grounded writes
    let groundedWrites: Item[] = [];


    /** function to record a write through a reference in pendingdeltas */
    const writeRef = (ref: Reference, value: Item) => {
      let target = ref.target!;
      if (!context.contains(target)) {
        // write leaving feedback context

        if (context.container instanceof Loop
          && context.container.template === context
        ) {
          // called from analysis of for-all to check for escaping writes
          if (cast(context.value, Do).items[0].getMaybe('^reference')?.value
            === ref) {
            // the write to the source of the for-all block is ignored
            assert(this.analyzing);
            return;
          }
          throw new CompileError(arrayLast(ref.tokens),
            'external write from for-all')
        }

        // TODO: passivation or lenses
        throw new CompileError(arrayLast(ref.tokens),
          'write outside context of update')
      }
      if (!context.writeSink(target)) {
        throw new CompileError(arrayLast(ref.tokens), 'not updatable')
      }
      target.setDelta(value);
      // forward write through selections
      context.writeSelection(target, ref.containingItem).forEach(writePending);
    }

    /** function to record a write in pendingWrites */
    const writePending = (write: Item) => {
      // insert into pending deltas sorted by location
      let i = pendingWrites.length;
      while (--i >= 0) {
        let pending = pendingWrites[i];
        if (pending === write) {
          // conflicting write at same location
          throw new CompileError(write, 'write conflict');
        }
        if (pending.comesBeforeOrContains(write)) break;
        continue
      }
      pendingWrites.splice(i + 1, 0, write);
    }

    /** write to result of a Code block. analyzeForAll flag set when
     * analyzing a for-all update
     */
    const writeCode = (code: Code, delta: Item, analyzeForAll = false) => {
      if (arrayLast(code.statements).dataflow !== 'on-update') {
        // no on-update block - write delta onto result of code block
        if (code instanceof Try && this.analyzing) {
          // during analysis speculatively update each clause, then merge
          for (let clause of code.statements) {
            //clause.resolve();
            clause.setDelta(delta);
            // do rest of feedback for just this clause
            let grounds = this.feedback(context, ...[...pendingWrites, clause]);
            // merge resultant grounded writes together
            grounds.forEach(grounded => {
              if (groundedWrites.includes(grounded)) return;
              groundedWrites.push(grounded);
            })
          }
          // terminate feedback with merged speculative feedbacks
          pendingWrites = [];
          return
        }

        // write result
        let resultDelta = code.result!.setDelta(delta);
        if (analyzeForAll) {
          // analyzing for-all
          // set result different
          resultDelta.uncopy();
          // check for feedback leaving for-all block
          this.feedback(code.containingItem, code.result!)
        }
        writePending(code.result!);
        return
      }

      // execute on-update block
      // note types were already checked during analysis of def site
      let onUpdate = cast(arrayLast(code.statements).value, OnUpdate);

      // set input delta of on-update block
      onUpdate.uneval();
      let input = onUpdate.statements[0];
      assert(input.io === 'input')
      if (input.value) {
        // possible that input got evaluated by deferred analysis
        assert(this.analyzing);
        input.detachValue();
      }
      input.setFrom(delta);
      // evaluate on-update and queue up writes
      onUpdate.eval();

      if (onUpdate.editError) {
        // skip if error in update block
        this.propagateError(onUpdate);
        return;
      }

      // Execute all internal write statements
      // this will traverse all try clauses during analysis
      for (let statement of onUpdate.writeStatements()) {
        const ref = cast(statement.get('^target').value, Reference);
        if (analyzeForAll && !code.containingItem.contains(ref.target!)) {
          throw new CompileError(arrayLast(ref.tokens),
            'external write from for-all')
        }
        assert(!statement.editError);
        writeRef(ref, statement);
      }
    }

    while (pendingWrites.length) {
      const write = pendingWrites.pop()!;
      write.eval();
      const delta = assertDefined(write.deltaField);
      delta.eval();

      // discard equi-writes
      if (this.analyzing) {
        // in analysis, error if writing copy, which is static no-op
        if (delta.value!.isCopyOf(write.value!)) {
          throw new CompileError(write, 'writing same value');
        }
        // otherwise treat as different
      } else {
        // discard write equal to current value
        if (write.value!.equals(delta.value!)) continue;
      }

      // lift deltas to containing write sink
      let writeSink = context.writeSink(write);
      if (!writeSink) {
        // unwritable location
        throw new CompileError(write, 'not updatable');
      }
      if (writeSink !== write) {
        // writes within sink are lifted into its ^delta
        let sinkDelta: Metafield | undefined;
        // scan prior writes for conflicts or existing write to sink
        for (let prior of arrayReverse(pendingWrites)) {
          if (prior === writeSink) {
            // existing write
            sinkDelta = assertDefined(writeSink.deltaField);
            if (sinkDelta.value!.source !== writeSink.value) {
              // conflict with non-lifted delta
              throw new CompileError(write, 'write conflict');
            }
            break;
          }
          if (prior.comesBeforeOrContains(writeSink)) {
            break;
          }
          if (prior.contains(write)) {
            // conflict with containing write
            throw new CompileError(write, 'write conflict');
          }
        }
        if (!sinkDelta) {
          // initialize sink delta from current value to lift write
          sinkDelta = writeSink.setDelta(writeSink);
          writePending(writeSink);
        }
        // write into sink at downward path
        let sinkTarget =
          sinkDelta.down(write.path.ids.slice(writeSink.path.length));
        assert(sinkTarget.dataLike);
        sinkTarget.detachValue();
        sinkTarget.setFrom(delta);
        continue;
      }

      // changes to inputs
      if (write.inputLike) {
        if (write.io === 'input' && write.container instanceof Code) {
          // code parameter
          if (write.container.items[0] === write
            ) {
            // source input
            let call = write.container.containingItem.container;
            if (call instanceof Call) {
              // source input of a call - propagate delta into call
              let inputUpdate = call.statements[1];
              assert(inputUpdate.formulaType === 'updateInput');
              let ref = inputUpdate.get('^payload').get('^reference').value;
              assert(ref instanceof Reference);
              writeRef(ref, delta);
              continue;
            } else if (call instanceof Loop) {
              // source input of a loop block - propagate back through reference
              assert(write.formulaType === 'reference');
              let ref = cast(write.get('^reference').value, Reference);
              writeRef(ref, delta);
              continue;
            }
          }
          throw new CompileError(write, 'not updatable');
        } else {
          // ground out input write
          // check for conflicting content writes
          groundedWrites.forEach(grounded => {
            if (write.contains(grounded)) {
              throw new CompileError(write, 'write conflict');
            }
          })
          groundedWrites.push(write);
          continue;
        }
      }

      switch (write.formulaType) {

        case 'call':
        case 'code': {
          let code: Code;
          if (write.formulaType === 'call') {
            // call body is value of last statement of call
            let call = cast(write.get('^call').value, Call);
            code = cast(arrayLast(call.statements).value, Do);
            if (!code.result) {
              // during analysis eval short-circuits on possibly recursive funcs
              throw new CompileError(write, 'called function not updatable')
            }
          } else {
            code = cast(write.get('^code').value, Code);
          }

          writeCode(code, delta);
          break;
        }

        case 'reference': {
          // write through reference
          writeRef(cast(write.get('^reference').value, Reference), delta);
          break;
        }

        case 'builtin': {
          let updateDelta = updateBuiltin(cast(write, Statement), delta);
          writePending(updateDelta.base);
          break;
        }

        case 'update': {
          // reverse execution of update: write change in target into payload,
          // then other changes back into context ref
          // During analysis uses copyOf to test whether to propagate write
          const targetRef = cast(write.get('^target').value, Reference);
          assert(!targetRef.rejected || this.analyzing);
          // path to target within context
          const targetPath = targetRef.path.ids.slice(targetRef.context);
          const deltaTarget = delta.down(targetPath);
          if (!deltaTarget.value!.staticEquals(write.down(targetPath).value!)) {
            // target value changed
            let payload = write.get('^payload');
            payload.setDelta(deltaTarget);
            writePending(payload);
          }
          // pass through remaining changes to context
          const updateContext = this.workspace.down(
            targetRef.path.ids.slice(0, targetRef.context));
          assert(context.writeSink(updateContext) === updateContext);
          const contextDelta = updateContext.setDelta(delta);
          // mask changes to target region by copying current value
          const contextTarget = contextDelta.down(targetPath);
          contextTarget.detachValue();
          contextTarget.copyValue(updateContext.down(targetPath));
          if (!contextDelta.value!.staticEquals(updateContext.value!)) {
            // pass context write if changed
            writePending(updateContext);
          }
          break;
        }

        case 'extend': {
          // reverse execution of extend
          // split feedback between source and extension
          let extending = cast(write.get('^extend').value, Record);
          let ref = cast(write.get('^reference').value, Reference);
          let sourceRec = cast(ref.target!.value, Record);
          let deltaRec = cast(delta.value, Record);
          let origRec = cast(write.value, Record);
          for (let i = 0; i < origRec.fields.length; i++) {
            let deltaField = deltaRec.fields[i];
            let origField = origRec.fields[i];
            if (!origField.dataLike
              || deltaField.value!.staticEquals(origField.value!)
            ) {
              // ignore if not input or unchanged
              // interfaces are ignored because they should have already
              // intercepted changes
              continue;
            }
            if (i < sourceRec.fields.length) {
              // send write to source
              let sourceField = sourceRec.fields[i];
              sourceField.setDelta(deltaField);
              writePending(sourceField);
            } else {
              // send write to extension
              let extensionField = extending.fields[i];
              extensionField.setDelta(deltaField);
              writePending(extensionField);
            }
          }
          break;
        }


        case 'loop': {
          // TODO: move this code into array.ts
          const loop = cast(write.get('^loop').value, Loop);
          const source = loop.input;

          switch (loop.loopType) {

            case 'find?':
            case 'find!': {
              // TODO: feedback into found item
              trap();
            }

            case 'all!':
            case 'all?':
            case 'none!':
            case 'none?': {
              // feedback changes to source
              let sourceItem = source.containingItem;
              sourceItem.setDelta(delta);
              writePending(sourceItem);
              break;
            }

            case 'such-that': {
              // overwrite changes into source
              if (!source.tracked) {
                throw new CompileError(write,
                  'such-that not updatable for untracked array');
              }
              // first set delta to copy of original source value
              let sourceItem = source.containingItem;
              let sourceDelta = sourceItem.setDelta(sourceItem);
              writePending(sourceItem);
              let sourceDeltaArray = sourceDelta.value;
              assert(sourceDeltaArray instanceof _Array);
              let resultArray = write.value;
              assert(resultArray instanceof _Array);
              let deltaArray = delta.value;
              assert(deltaArray instanceof _Array);
              if (this.analyzing) {
                // change everything during analysis
                sourceDelta.uncopy();
                if (deltaArray.serial !== resultArray.serial) {
                  // pass through creates and deletes
                  sourceDeltaArray.serial++
                }
                break;
              }
              // scan items in original result of such-that
              for (let resultItem of resultArray.items) {
                let sourceItem = sourceDelta.get(resultItem.id);
                let deltaItem = deltaArray.getMaybe(resultItem.id);
                if (!deltaItem) {
                  // item deleted in delta; delete from source
                  arrayRemove(sourceDeltaArray.items, sourceItem as Entry);
                  continue;
                }
                // change source item
                sourceItem.detachValue();
                sourceItem.setFrom(deltaItem);
                // FIXME move source item if moved in delta
              }
              // feedback creations
              assert(resultArray.serial === sourceDeltaArray.serial);
              for (
                let id = resultArray.serial + 1;
                id <= deltaArray.serial;
                id++
              ) {
                sourceDeltaArray.serial = id;
                let deltaItem = deltaArray.getMaybe(id);
                if (deltaItem) {
                  // feedback creation
                  let sourceItem = new Entry;
                  sourceDeltaArray.add(sourceItem);
                  sourceItem.io = 'input';
                  sourceItem.formulaType = 'none';
                  sourceItem.id = id;
                  sourceItem.setFrom(deltaItem);
                  // FIXME: move creation if moved in delta
                }
              }
              break;
            }


            case 'for-all': {
              if (!source.tracked) {
                throw new CompileError(write,
                  'for-all not updatable for untracked array');
              }
              // first set delta of source to copy of its original value
              let sourceItem = source.containingItem;
              let sourceDelta = sourceItem.setDelta(sourceItem);
              writePending(sourceItem);
              let sourceDeltaArray = sourceDelta.value;
              assert(sourceDeltaArray instanceof _Array);
              // feedback changed items
              let resultArray = write.value;
              assert(resultArray instanceof _Array);
              let deltaArray = delta.value;
              assert(deltaArray instanceof _Array);
              if (this.analyzing) {
                // in analysis: update for-block template
                let templateBlock = cast(loop.template.value, Do);
                // write current result back to it
                // set special flag to bound effects
                writeCode(templateBlock, templateBlock.result!, true)
                if (deltaArray.serial !== resultArray.serial) {
                  // pass through creates and deletes
                  sourceDeltaArray.serial++
                }
                if (sourceDeltaArray.isCopyOf(sourceItem.value as _Array)) {
                  // no changes made to source, so remove its delta
                  arrayRemove(pendingWrites, sourceItem);
                }
                break;
              } else {
                for (let resultItem of resultArray.items) {
                  let deltaItem = deltaArray.getMaybe(resultItem.id);
                  if (!deltaItem) {
                    // item deleted in delta; delete from source
                    arrayRemove(
                      sourceDeltaArray.items,
                      sourceDelta.get(resultItem.id) as Entry);
                    continue;
                  }
                  if (resultItem.value.equals(deltaItem.value)) {
                    // ignore if value unchanged
                    continue;
                  }
                  // write changed item to for-all block instance
                  let instance = loop.get(resultItem.id);
                  writeCode(cast(instance.value, Do), deltaItem)
                  continue;
                }
              }
              // feedback creations
              assert(resultArray.serial === sourceDeltaArray.serial);
              for (
                let id = resultArray.serial + 1;
                id <= deltaArray.serial;
                id++
              ) {
                sourceDeltaArray.serial = id;
                let deltaItem = deltaArray.getMaybe(id);
                if (deltaItem) {
                  /** creation feedback. Uses special ghost items in the source
                   * array and the for-all loop, so that the creation can
                   * feedback through the for-all code block
                   */
                  let sourceGhost = source.createGhost(id);
                  let sourceDeltaCreate = new Entry;
                  sourceDeltaCreate.id = id;
                  sourceDeltaArray.add(sourceDeltaCreate);
                  sourceDeltaCreate.io = 'input';
                  sourceDeltaCreate.formulaType = 'none';
                  sourceDeltaCreate.setFrom(sourceDeltaArray.template);

                  // link for-all iteration to source ghost
                  let iteration = loop.createGhost(id);
                  // copied from Loop.eval()
                  iteration.uneval();
                  let iterInput = iteration.value!.items[0];
                  assert(iterInput.formulaType === 'reference');
                  let iterRef = cast(iterInput.get('^reference').value, Reference);
                  assert(arrayLast(iterRef.path.ids) === 0);
                  iterRef.path = sourceGhost.path;
                  assert(!iterRef.target);
                  iteration.eval();
                  let iterationResult = cast(iteration.value, Do).result!;

                  // compare creation to ghost for-all result
                  if (deltaItem.value!.equals(iterationResult.value)) {
                    // creation doesn't change ghost mapping
                    // leave default source creation
                    continue;
                  }
                  iterationResult.setDelta(deltaItem);
                  writePending(iterationResult);
                  continue;
                  // FIXME: move creation if moved in delta
                }
              }
              break;
            }

            case 'accumulate': {
              // TODO: feedback through chained functions
              trap();
            }

            default: trap();
          }
          break;
        }


        default:
          throw new CompileError(write, 'not updatable');
      }
      continue;
    }
    return groundedWrites;
  }


/* --------------------------------- edit ----------------------------------- */


  /** evaluate edit operations */
  private edit() {
    // Edits only execute in history
    assert(this instanceof Version);
    // get target path in input
    const targetRef = cast(this.get('^target').value, Reference);
    assert(targetRef.dependent);
    // get input version, which is context of reference
    const input = this.workspace.down(
      targetRef.path.ids.slice(0, targetRef.context)
    );
    // copy input to result value, to be edited as needed
    this.copyValue(input);
    // erase edit errors for re-analysis, but keep conversion errors
    for (let item of this.value!.visit()) {
      if (item.originalEditError !== 'conversion') {
        item.editError = undefined;
      }
    }
    const targetPath = targetRef.path.ids.slice(targetRef.context);
    // get target within result
    const target = this.down(targetPath)
    assert(target);
    // FIXME: only editing data fields for now
    assert(target.io === 'data');

    /** Iterate edit over nested arrays */
    function iterateEdit(
      context: Item,
      path: ID[],
      editor: (item: Item) => void
    ) {
      // detect if target is inside an array entry or template
      let index = path.findIndex(id => typeof id === 'number');
      if (index >= 0) {
        // recurse on array template and items
        // MAYBE: require edit to be specified on template?
        // assert(path[index] === 0);
        let array = context.down(path.slice(0, index)).value;
        assert(array instanceof _Array);
        let arrayPath = path.slice(index + 1);
        iterateEdit(array.template, arrayPath, editor);
        array.items.forEach(item => iterateEdit(item, arrayPath, editor));
        return;
      }
      // editor target
      const target = context.down(path)
      editor(target);
    }

    /** Disallow references outside literal value*/
    // TODO: could literalize references
    function literalCheck(literal: Item) {
      for (let item of literal.visit()) {
        if (item.value instanceof Reference
          && !literal.contains(item.value.target!)
        ) {
          throw new CompileError(item, 'reference escaping literal value');
        }
      }

    }

    switch (this.formulaType) {

      case '::replace': {
        // optional ^source is literal or reference
        const source = this.get('^source');
        literalCheck(source);
        // function to perform edit
        function editor(target: Item) {
          if (source.value instanceof Reference) trap();
          // replace target with a literal value
          target.detachValue();
          target.copyValue(source);
          // FIXME set copy source to template
        }

        iterateEdit(this, targetPath, editor)
        break;
      }

      case '::append':
      case '::insert': {
        const append = this.formulaType === '::append';
        if (append && !(target.value instanceof Record)) {
          throw new CompileError(target, 'can only append to record')
        } else if (!append && !(target.container instanceof Record)) {
          throw new CompileError(target, 'can only insert into record')
        }
        // ^source is Record containing field to append/insert
        const source = cast(this.get('^source').value, Record).fields[0];
        assert(source);
        literalCheck(source);

        // function to perform edit
        function editor(target: Item) {
          let newField = new Field;
          if (append) {
            // append to record
            cast(target.value, Record).add(newField);
          } else {
            // insert before field
            let record = target.container as Record;
            newField.container = record;
            let i = record.fields.indexOf(target as Field);
            assert(i >= 0);
            record.fields.splice(i, 0, newField);
          }
          newField.id = source.id;
          newField.io = source.io;
          newField.formulaType = source.formulaType;
          if (source.value instanceof Reference) trap();
          newField.copyValue(source);
          // FIXME set copy source to template
        }

        iterateEdit(this, targetPath, editor)
        break;
      }

      case '::convert': {
        // optional ^source is literal or reference
        const to = this.get('^source');
        literalCheck(to);
        const toType = assertDefined(to.value);
        if (!(toType instanceof Base || toType instanceof Text)) {
          throw new CompileError(to, 'can only convert to base types and text');
        }

        // function to perform edit
        function editor(target: Item) {
          let fromVal = assertDefined(target.value);
          target.detachValue();
          target.editError = undefined;
          if (toType instanceof Reference) trap();
          if (toType instanceof Nil) {
            // anything can be converted to Nil
            target.setValue(new Nil);
            return;
          }
          if (fromVal instanceof Nil) {
            // Nil gets converted to value of to type
            target.copyValue(to);
            return;
          }

          // convert to text
          if (toType instanceof Text) {
            if (fromVal instanceof Text) {
              // noop
              target.setValue(fromVal);
              return;
            }

            // default to value of toType
            let text = new Text;
            target.setValue(text);
            text.value = toType.value

            if (fromVal instanceof _Number) {
              // number to text
              if (fromVal.isBlank()) {
                // NaN converts to value of toType
                // FIXME - should it be blank value?
              } else {
                // use standard JS numnber to string conversion
                text.value = fromVal.value.toString();
              }
              return;
            }

            if (fromVal instanceof Character) {
              text.value = fromVal.value;
              return;
            }

            // other types convert to toType value
            return;
          }

          // convert to number
          if (toType instanceof _Number) {
            if (fromVal instanceof _Number) {
              // noop
              target.setValue(fromVal);
              return;
            }
            let num = new _Number;
            target.setValue(num);

            if (fromVal instanceof Character) {
              num.value = fromVal.value.charCodeAt(0);
              return;
            }
            if (fromVal instanceof Text) {
              // convert text to number, which may fail
              let text = fromVal.value.trim();
              if (text) {
                num.value = Number(text);
                if (Number.isNaN(num.value)) {
                  // conversion error
                  target.editError = 'conversion';
                }
              } else {
                // convert empty/whitespace text to NaN
                num.value = Number.NaN;
              }
              return;
            }

            // other types convert to toType value
            num.value = toType.value;
            return;
          }

          // unrecognized conversion type
          trap();
        }

        iterateEdit(this, targetPath, editor)
        break;
      }


      default:
        trap();
    }

    // analyze results of edit
    this.workspace.analyze(this);
  }




/* -------------------------------------------------------------------------- */


  /** Iterate through containing items, starting with this and ending with
   * Workspace */
  *containmentWalk(): Generator<Item> {
    for (
      let item: Item = this;
      item.container;
      item = item.container.containingItem
    ) {
      yield item;
    }
  }

  /** whether this item comes before other item in tree (but doesn't contain
   * other item) */
  comesBefore(other: Item): boolean {
    // construct containment arrays starting with workspace
    let thisItems = Array.from(this.containmentWalk()).reverse();
    let otherItems = Array.from(other.containmentWalk()).reverse();
    for (let i = 0; i < Math.min(thisItems.length, otherItems.length); i++) {
      // find where containment paths diverge
      let thisItem = thisItems[i];
      let otherItem = otherItems[i];
      if (thisItem === otherItem) continue;
      assert(i > 0); // workspaces must be the same

      let siblings = thisItem.container.items;
      if (siblings !== otherItem.container.items) {
        // comparing metadata and base data
        // metadata comes before base data
        return thisItem instanceof Metafield;
      }
      // compare container indexes
      return siblings.indexOf(thisItem) < siblings.indexOf(otherItem)
    }
    // one item contains other
    // If this item is metadata of other it comes before
    return thisItems[otherItems.length] instanceof Metafield;
  }

  comesBeforeOrContains(other: Item): boolean {
    return this.contains(other) || this.comesBefore(other);
  }

  /** unevaluate */
  uneval() {
    this.resolve();
    if (this.metadata) this.metadata.uneval();
    if (this.delta) {
      this.delta.containingItem = undefined as any;
      this.delta = undefined;
    }
    this.evaluated = false;
    assert(this.formulaType);
    this.rejected = false;
    if (this.formulaType === 'none') {
      // recurse on predefined values
      if (this.inputLike) {
        // break source connection
        this.value!.source = undefined;
      }
      this.value!.uneval();
      return;
    }
    // recalc value
    this.detachValueIf();
  }

  /** detach value, so a new one can be set */
  detachValue() {
    assert(this.value?.containingItem === this);
    this.value.containingItem = undefined as any;
    this.value = undefined;
    this.evaluated = false;
  }

  /** detach value if defined */
  detachValueIf() {
    if (this.value) this.detachValue();
  }

  /** whether item has been detached */
  isDetached(): boolean {
    for (let up: Item = this; up; up = up.container.containingItem) {
      if (up instanceof Workspace) {
        return false;
      }
    }
    return true;
  }

  /** set detached value */
  setValue(value: Value) {
    assert(!this.value);
    assert(!value.containingItem);
    this.value = value as V;
    value.containingItem = this;
  }

  /** Copy current value from another item, translating internal path. Does
   * nothing if item or its value are undefined */
  copyValue(src?: Item) {
    if (src && src.value) {
      this.setValue(src.value.copy(src.path, this.path));
    }
  }

  /** set value, allowing JS base values. Copies Value if attached.
   * Asserts argument defined */
  setFrom(from?: number | string | Value | Item) {
    assert(from !== undefined);
    if (typeof from === 'number') {
      let value = new _Number;
      value.value = from
      this.setValue(value);
    } else if (typeof from === 'string') {
      let value = new Text;
      value.value = from;
      this.setValue(value);
    } else {
      let value = from instanceof Item ? assertDefined(from.value) : from;
      if (value.containingItem) {
        // copy attached value
        this.setValue(value.copy(value.containingPath, this.path));
      } else {
        // set detached Value
        this.setValue(value);
      }
    }
  }

  // /** replace current value from another item, translating internal path. Just
  //  * prunes current value if item or its value are undefined */
  // replaceValue(src?: Item) {
  //   this.prune();
  //   if (src && src.value) {
  //     this.setValue(src.value.copy(src.path, this.path));
  //   }
  // }

  /** source of value through copying */
  // Currently only Value.source is used
  // source?: this;

  /** original source of this item via copying. That is, its definition */
  // get origin(): this {
  //   return this.source ? this.source.origin : this;
  // }

  /** make copy, bottom up, translating paths contextually */
  copy(srcPath: Path, dstPath: Path): this {
    if (this.path.length > Item.DepthLimit) {
      throw new Crash(this.container.token!, 'Workspace too deep')
    }

    let to = another(this);
    to.id = this.id;
    to.formulaType = this.formulaType;
    to.io = this.io;
    to.conditional = this.conditional;
    to.usesPrevious = this.usesPrevious;

    // record copy
    // to.source = this;

    if (this.deferral) {
      // defer copying a deferred item
      to.evaluated = undefined;
      to.deferral = () => {
        // resolve this item
        assert(this.container && to.container)
        this.resolve();
        let newCopy = this.copy(srcPath, dstPath);
        // tranfer new copy to original deferred copy already in workspace
        assert(to.id === newCopy.id);
        to.formulaType = newCopy.formulaType;
        to.io = newCopy.io;
        to.conditional = newCopy.conditional;
        to.usesPrevious = newCopy.usesPrevious
        if (newCopy.metadata) {
          to.metadata = newCopy.metadata;
          to.metadata.containingItem = to;
        }
        let newValue = newCopy.value!;
        newCopy.detachValue();
        to.setValue(newValue);
        // evaluate
        to.eval();
      }
      return to;
    }

    // copy metadata
    if (this.metadata) {
      to.metadata = this.metadata.copy(srcPath, dstPath);
      to.metadata.containingItem = to;
    }

    // copy underived values
    if (this.value && !this.isDerived) {
      assert(this.value.containingItem === this);
      to.value = this.value.copy(srcPath, dstPath);
      to.value.containingItem = to;
      // copy edit error on underived value
      // MAYBE: if copying across versions, copy don't link error
      to.propagateError(this);
    }

    return to;
  }

  /** break copying provenance so treated as statically different */
  uncopy() {
    for (let item of this.visitBase()) {
      if (item.inputLike && item.value) {
        // forget input item source
        item.value.source = undefined;
      }
      if (item.value instanceof _Array) {
        // break copying of array template too
        item.value.template.uncopy();
      }
    }
    this.value!.source = undefined;
  }

  /** Type-checking for update operations. Can this item be updated from
   * another? Recurses within a path context, which defaults to item paths */
  updatableFrom(from: Item, fromPath?: Path, thisPath?: Path): boolean {
    this.resolve();
    from.resolve();
    if (!thisPath) thisPath = this.path;
    if (!fromPath) fromPath = from.path;
    return (
      this.id === from.id
      && this.io === from.io
      && this.conditional === from.conditional
      && this.formulaType === from.formulaType
      && (
        this.formulaType !== 'none'
        || this.value!.updatableFrom(from.value!, fromPath, thisPath)
      )
      && !!this.metadata === !!from.metadata
      && (
        !this.metadata
        || this.metadata.updatableFrom(from.metadata!, fromPath, thisPath)
      )
    )
  }

  /** item equality, assuming changeableFrom is true */
  equals(other: Item) {
    return (
      this.id === other.id
      && this.rejected === other.rejected
      && !!this.value === !!other.value
      && (!this.value || this.value.equals(other.value))
    )
  }

  // dump value
  dump() { return this.value ? this.value.dump() : {'': 'undefined'}}
}

/** FIXME: if could be result of an edit, reify into Item.editError so workspace
 * stays live */
export class CompileError extends Error {
  constructor(token: Token | Item | undefined, description: string) {
    super(description + ': ' + CompileError.context(token));
  }
  private static context(token?: Token | Item): string {
    if (token instanceof Item) {
      if (token instanceof Field) {
        token = token.id.token;
      } else {
        token = undefined;
      }
    }
    return (
      token instanceof Token
        ? token.source.slice(token.start, token.end + 10)
        : 'unknown'
    )
  }
}

/** dynamic crash error */
export class Crash extends Error {
  constructor(token?: Token, description = 'crash') {
    super(
      description + ': '
      + token?.source?.slice(token.start, token.end + 10)
    );
  }
}