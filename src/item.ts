import { Workspace, ID, Path, Container, Value, RealID, Metadata, MetaID, isString, another, Field, Reference, trap, assert, Code, Token, cast, arrayLast, Call, Text, evalBuiltin, Try, assertDefined, builtinWorkspace, Statement, Choice, arrayReplace, Metafield, _Number, Nil, Loop, OptionReference, OnUpdate, updateBuiltin, Do, DeltaContainer, _Boolean} from "./exports";
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

  /** memoized Workspace */
  _workspace?: Workspace;
  get workspace(): Workspace {
    if (!this._workspace) {
      this._workspace = this.container.workspace;
    }
    return this._workspace;
  }

  /** ID of the item within its container */
  id!: I;

  /** memoized Path */
  _path?: Path;
  get path(): Path {
    if (!this._path) {
      this._path = this.container.containingItem.path.down(this.id);
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
  get inTemplate() { return this.path.ids.includes(0) }

  /** Logical container: metadata is physically contained in base item, but
   * logically is a peer */
  get up(): Item {
    return this.container!.up;
  }

  /** iterate upwards through logical containers to Workspace */
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
        assert(this.isInput);
        this.resolve();
        let copy = this.copy(this.path, this.path.down(MetaID.ids['^initial']));
        let initial = this.setMeta('^initial');
        // transfer copy into metafield
        initial.formulaType = copy.formulaType;
        initial.isInput = false;
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

  /** set a metadata field by name. Must not already exist. Value can be
   * undefined */
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


/* ------------------------------- evaluation ------------------------------- */


  /**
   * How value is computed. The formula is stored in various metadata fields
   * depending on this tag.
   *
   * FIXME: this sould be encoded as metadata using standard datatypes.
   * formulaType should become a Choice. Optionality should be made explicit.
   *
   * none: value is a constant in item.value. Used for literal outputs.
   *
   * literal: value is in ^literal
   *
   * reference: value is target of a Reference in ^reference
   *
   * code: value is result of a Code block in ^code
   *
   * loop: value is result of a Loop block in ^loop
   *
   * update: dependent reference in ^target, formula in ^payload
   *
   * updateInput: special update used for input of a call
   *
   * write: formula in ^writeValue or ^payload, structural reference in ^target
   *
   * choose: dependent optionReference in ^target, optional formula in ^payload
   *
   * call: Call block in ^call, starting with reference to function followed by
   * updates on the arguments
   *
   * include: currently includes only builtins
   *
   * builtin: ^builtin contains name of builtin as a Text value
   *
   *  */
  formulaType: (
    'none' | 'literal' | 'reference' | 'code' | 'update' | 'updateInput'
    | 'write' | 'choose' | 'call' | 'include' | 'builtin' | 'loop'
  ) = 'none';

  /** whether input or output item */
  isInput = false;

  /** updatable output */
  isUpdatableOutput = false;

  /** whether value should be rederived on copies */
  get isDerived() {
    return !this.isInput && this.formulaType !== 'none'
  }

  /** whether item can reject having a value. Determined during analysis */
  conditional = false;

  setConditional(b?: boolean) {
    if (!b) return;
    if (this.workspace.analyzing) {
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
    assert(!this.isDetached() && this.workspace.analyzing)
    // set item unevaluated, with deferral to catch cycles
    this.evaluated = false;
    this.deferral = () => {
      throw new StaticError(this, 'circular dependency')
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
          this.copyValue(ref.target);
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
        case 'choose':
          this.update();
          break;

        case 'write':
          assert(this instanceof Statement);
          const writeValue =
            this.getMaybe('^writeValue') || this.get('^payload');
          if (this.workspace.analyzing) {
            // must be inside an on-update block
            for (let up of this.upwards()) {
              if (up.value instanceof OnUpdate) break;
              if (up instanceof Workspace) {
                throw new StaticError(this, 'write must be in on-update block');
              }
            }
            // check target and type of writes
            let targetRef = cast(this.get('^target').value, Reference);
            let target = targetRef.target!;
            if (!target.value!.changeableFrom(writeValue.value!)) {
              throw new StaticError(this, 'write changing type')
            }
            if (!target.comesBefore(writeValue)) {
              throw new StaticError(arrayLast(targetRef.tokens), 'write must go backwards')
            }
            if (!target.isInput && !target.isUpdatableOutput) {
              throw new StaticError(arrayLast(targetRef.tokens),
                'cannot update');
              // note contextual writability of target is checked in update
            }
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

        default:
          trap();
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
      && !(this.value instanceof OnUpdate && !this.workspace.analyzing)) {
      this.value.eval();
    }

    this.evaluated = true;
  }

  /** iterate through nested evaluated statements */
  *evaluatedStatements(): Generator<Statement> {
    switch (this.formulaType) {
      case 'code':
        yield *cast(this.get('^code').value, Code).evaluatedStatements();
        break;

      case 'loop':
        let loop = cast(this.get('^loop').value, Loop);
        trap(); // FIXME
        break;

      case 'call':
        let call = cast(this.get('^call').value, Call);
        for (let arg of call.statements.slice(1)) {
          yield* arg.evaluatedStatements();
        }
        const body = arrayLast(call.statements).value;
        yield* cast(body, Do).evaluatedStatements();
        break;

      case 'update':
      case 'updateInput':
      case 'choose':
        let payload = this.getMaybe('^payload');
        if (payload) {
          yield* payload.evaluatedStatements();
        }
        break;

      case 'write':
        const writeValue = this.getMaybe('^writeValue') || this.get('^payload');
        yield *writeValue.evaluatedStatements();
        break;
    }
  }

  /** get result of code or call */
  private result(code: Code) {
    this.setConditional(code.conditional);
    this.rejected = code.rejected;
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
    assert(this.workspace.analyzing);
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


/* --------------------------------- update --------------------------------- */


  /** whether a contained item is writable in this context. Must be inputs up to
   * a containing updatable output or this. Returns the containing updatable
   * output or the original input */
  isWritable(item: Item): Item | undefined {
    // scan upwards to this
    for (let up = item; up !== this; up = up.container.containingItem) {
      // updatableOutputs are writable
      if (up.isUpdatableOutput) return up;
      // can write into any code block statement
      if (up instanceof Statement) return up;
      // can write into := payload FIXME maybe require `:=|>` to be writable
      if (up.id === MetaID.ids['^payload']) return up;
      if (!up.isInput) return undefined;
    }
    // Inputs all the way up so can write to original item
    return item;
  }


  /** Optional container for a ^delta value set during replaces. Kept out of
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
    }
    let deltaField = this.delta.deltaField;
    if (deltaField.value) {
      deltaField.detachValue();
    }
    if (from) {
      deltaField.setFrom(from);
    }
    return deltaField;
  }



  /** evaluate update/choose operation
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
      if (!this.workspace.analyzing) return;
    }
    let target = ref.target;
    assert(target);
    const context = this.workspace.down(ref.path.ids.slice(0, ref.context));
    context.eval();

    // Set ^delta on target to changed value
    let delta: Metafield;
    const payload = this.getMaybe('^payload');
    if (payload) {
      this.setConditional(payload.conditional);
      if (payload.rejected) this.rejected = true;
      assert(payload.value);
    }

    if (this.formulaType === 'choose') {
      // choose
      assert(ref instanceof OptionReference);
      // copy change from current value
      delta = target.setDelta(target);
      let choice = cast(delta.value, Choice);
      // set choice
      choice.setChoice(choice.items.findIndex(
        option => option.id === ref.optionID));
      let option = choice.choice;
      // resolve deferred analysis of the option
      option.resolve();
      if (payload) {
        // replace target value with payload value
        option.eval();
        if (!option.value!.changeableFrom(payload.value!)) {
          throw new StaticError(arrayLast(ref.tokens), 'changing type of value')
        }
        option.detachValue();
        option.copyValue(payload);
      }
      if (target === context) {
        // replace value of entire context
        this.copyValue(delta);
        return;
      }
    } else {
      // replace needs to be within context
      assert(target !== context);
      assert(payload);
      // replace target value with payload value
      if (!target.value!.changeableFrom(payload.value!)) {
        throw new StaticError(arrayLast(ref.tokens), 'changing type of value')
      }
      delta = target.setDelta(payload);
    }

    // propagate updates within context
    let groundedDeltas =
      (this.container instanceof Call)
        // don't propagate function argument assignments
        ? [delta]
        : context.propagateUpdates(delta);


    // replace grounded deltas in result copied from context
    if (this.value) {
      this.detachValue();
    }
    this.copyValue(context);
    for (let grounded of groundedDeltas) {
      // follow path within delta context
      let target = this.down(grounded.base.path.ids.slice(ref.context));
      target.detachValue();
      target.copyValue(grounded);
    }


    if (this.formulaType === 'updateInput') {
      // initialize call body to recalc arg defaults from input value,
      // preserving primary input value
      // FIXME: maybe compile this into an explicit initialize oepration?
      // But don't want to init primary input.
      cast(this.value, Code).statements.slice(1).forEach(statement =>
        statement.initialize())
    }

  }


  /** update propagation. Deltas propagated in reverse tree order until
   * all grounded at inputs. Receiving item is the bounding context of change
   * @param delta initial ^delta field
   * @returns array of grounded deltas */
  propagateUpdates(delta: Metafield): Metafield[] {

    // stack of pending deltas, sorted in tree order
    let pendingDeltas = [delta];
    // result array of grounded deltas
    let groundedDeltas: Metafield[] = [];


    /** function to record a write through a reference in pendingdeltas */
    const writeRef = (ref: Reference, value: Item) => {
      let target = ref.target!;
      if (!this.contains(target)) {
        // TODO: defer changes that leave context
        trap();
      }
      if (!this.isWritable(target)) {
        throw new StaticError(arrayLast(ref.tokens), 'cannot update')
      }
      writeDelta(target.setDelta(value));
    }

    /** function to record a write in pendingdeltas */
    const writeDelta = (delta: Metafield, checkOverwrites = true) => {
      // insert into pending deltas sorted by location
      let i = pendingDeltas.length;
      while (--i >= 0) {
        let pending = pendingDeltas[i].base;
        if (pending.comesBefore(delta)) break;
        if (pending.contains(delta)) break;
        if (checkOverwrites && delta.containsOrEquals(pending)) {
          // overwrite
          // TODO: optionally treat as a static error
          pendingDeltas.splice(i, 0);
        }
        continue
      }
      pendingDeltas.splice(i + 1, 0, delta);
    }

    while (pendingDeltas.length) {
      let delta = pendingDeltas.pop()!;
      let deltaBase = delta.base;
      deltaBase.eval();

      // discard deltas equal to prior value
      if (!this.workspace.analyzing && deltaBase.value!.equals(delta.value!)) {
        continue;
      }

      // lift deltas to containing updatable output
      let outputBase = this.isWritable(deltaBase);
      if (!outputBase) {
        // unwritable location
        throw new StaticError(deltaBase, 'cannot update');
      }
      if (outputBase !== deltaBase) {
        // deltas within updatable output are lifted into its ^delta
        assert(outputBase.isUpdatableOutput);
        let outputdelta = outputBase.deltaField;
        if (!outputdelta) {
          // initialize containing output delta from prior value
          outputdelta = outputBase.setDelta(outputBase);
          // insert into pendingdeltas without overwriting content changes
          writeDelta(outputdelta, false);
        } else {
          // TODO: if outputdelta was explicitly written treat as overwrite
        }
        // write into output delta at downward path
        let target =
          outputdelta.down(deltaBase.path.ids.slice(outputBase.path.length));
        assert(target.isInput);
        target.detachValue();
        target.setFrom(delta);
        continue;
      }

      // changes to inputs
      if (deltaBase.isInput) {
        if (deltaBase.container instanceof Code) {
          // code input
          let call = deltaBase.container.containingItem.container;
          if (call instanceof Call &&
            deltaBase.container.items[0] === deltaBase
          ) {
            // primary input of a call - propagate delta into call
            let inputUpdate = call.statements[1];
            assert(inputUpdate.formulaType === 'updateInput');
            let ref = inputUpdate.get('^payload').get('^reference').value;
            assert(ref instanceof Reference);
            writeRef(ref, delta);
            continue;
          }
          throw new StaticError(deltaBase, 'cannot update');
        } else {
          // ground out data delta
          groundedDeltas.push(delta);
          continue;
        }
      }

      switch (deltaBase.formulaType) {

        case 'call':
        case 'code': {
          let code: Code;
          if (deltaBase.formulaType === 'call') {
            // call body is value of last statement of call
            let call = cast(deltaBase.get('^call').value, Call);
            code = cast(arrayLast(call.statements).value, Do);
            if (!code.result) {
              // during analysis eval short-circuits on possibly recursive funcs
              throw new StaticError(deltaBase, 'called function not updatable')
            }
          } else {
            code = cast(deltaBase.get('^code').value, Code);
          }

          if (arrayLast(code.statements).dataflow !== 'on-update') {
            // no on-update block - write delta onto result of code block
            if (code instanceof Try && this.workspace.analyzing) {
              // during analysis update all try clauses
              for (let clause of code.statements) {
                //clause.resolve();
                writeDelta(clause.setDelta(delta));
              }
            } else {
              writeDelta(code.result!.setDelta(delta));
            }
            continue;
          }

          // execute on-update block
          // note types were already checked during analysis of def site
          let onUpdate = cast(arrayLast(code.statements).value, OnUpdate);

          // set input delta of on-update block
          onUpdate.initialize();
          let input = onUpdate.statements[0];
          assert(input.isInput)
          if (input.value) {
            // possible that input got evaluated by deferred analysis
            assert(this.workspace.analyzing);
            input.detachValue();
          }
          input.setFrom(delta);
          // evaluate on-update and queue up writes
          onUpdate.eval();
          // Execute all internal write statements
          // this will traverse all try clauses during analysis
          for (let write of onUpdate.evaluatedStatements()) {
            if (write.formulaType !== 'write') continue;
            writeRef(cast(write.get('^target').value, Reference), write);
          }
          break;
        }

        case 'reference': {
          // write through reference
          writeRef(cast(deltaBase.get('^reference').value, Reference), delta);
          break;
        }

        case 'builtin': {
          writeDelta(updateBuiltin(cast(deltaBase, Statement), delta));
          break;
        }

        case 'update': {
          // reverse execution of update: write change in target into payload,
          // then other changes back into context ref
          // FIXME: finer-grained static analysis of updates to ignore
          // impossible payload and context updates
          const targetRef = cast(deltaBase.get('^target').value, Reference);
          assert(!targetRef.rejected || this.workspace.analyzing);
          // path to target within context
          const targetPath = targetRef.path.ids.slice(targetRef.context);
          const deltaTarget = delta.down(targetPath);
          if (!deltaTarget.value!.equals(deltaBase.down(targetPath).value!)) {
            // target value changed
            writeDelta(deltaBase.get('^payload').setDelta(deltaTarget));
            // mask target value change
            // check if any other change
          }
          // pass through remaining changes to context
          const updateContext = this.workspace.down(
            targetRef.path.ids.slice(0, targetRef.context));
          assert(this.isWritable(updateContext) === updateContext);
          const contextDelta = updateContext.setDelta(delta);
          writeDelta(contextDelta);
          // restore target region to prior value
          const contextTarget = contextDelta.down(targetPath);
          contextTarget.detachValue();
          contextTarget.copyValue(updateContext.down(targetPath));
          break;
        }

        default:
          throw new StaticError(deltaBase, 'cannot update');
      }
      continue;
    }
    return groundedDeltas;
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

  /** initialize all values */
  initialize() {
    this.resolve();
    if (this.metadata) this.metadata.initialize();
    if (this.delta) {
      this.delta.containingItem = undefined as any;
      this.delta = undefined;
    }
    this.evaluated = false;
    assert(this.formulaType);
    this.rejected = false;
    if (this.formulaType !== 'none') {
      // recalc value
      if (this.value) this.detachValue();
      return;
    }
    // recurse on predefined values
    this.value!.initialize();
  }

  /** detach value, so a new one can be set */
  detachValue() {
    assert(this.value?.containingItem === this);
    this.value.containingItem = undefined as any;
    this.value = undefined;
    this.evaluated = false;
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
  setFrom(from?: number | boolean | string | Value | Item) {
    assert(from !== undefined);
    if (typeof from === 'number') {
      let value = new _Number;
      value.value = from
      this.setValue(value);
    } else if (typeof from === 'boolean') {
      let value = new _Boolean;
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
        this.setValue(value.copy(value.containingItem.path, this.path));
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
  // FIXME prob should be a Path, translated through copies
  source?: this;

  /** original source of this item via copying. That is, its definition */
  get origin(): this {
    return this.source ? this.source.origin : this;
  }

  /** make copy, bottom up, translating paths contextually */
  copy(srcPath: Path, dstPath: Path): this {
    if (this.path.length > Item.DepthLimit) {
      throw new Crash(this.container.token!, 'Workspace too deep')
    }

    let to = another(this);
    to.id = this.id;
    to.formulaType = this.formulaType;
    to.isInput = this.isInput;
    to.isUpdatableOutput = this.isUpdatableOutput;
    to.conditional = this.conditional;
    to.usesPrevious = this.usesPrevious;

    // record copy
    to.source = this;

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
        to.isInput = newCopy.isInput;
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
    }

    return to;
  }

  /** Type-checking for update operations. Can this item be changed from
   * another. Recurses within a path context, which defaults to item paths */
  changeableFrom(from: Item, fromPath?: Path, thisPath?: Path): boolean {
    this.resolve();
    from.resolve();
    if (!thisPath) thisPath = this.path;
    if (!fromPath) fromPath = from.path;
    return (
      this.id === from.id
      && this.isInput === from.isInput
      && this.conditional === from.conditional
      && this.formulaType === from.formulaType
      && (
        this.formulaType !== 'none'
        || this.value!.changeableFrom(from.value!, fromPath, thisPath)
      )
      && !!this.metadata === !!from.metadata
      && (
        !this.metadata
        || this.metadata.changeableFrom(from.metadata!, fromPath, thisPath)
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

/** FIXME: reify into state so unaffected items can operate */
export class StaticError extends Error {
  constructor(token: Token | Item | undefined, description: string) {
    super(description + ': ' + StaticError.context(token));
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