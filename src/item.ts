import { Space, ID, Path, Container, Value, RealID, Metadata, MetaID, isString, assertDefined, another, Field, Reference, trap, assert, PendingValue, Code } from "./exports";
/**
 * An Item contains a Value. A Value may be a Container of other items. Values
 * that do not container other items are Base vales. This forms a tree. The top
 * item is a Space. Each contained item carries an ID, and we identify items
 * by the path of IDs down from the top.
 */

export abstract class Item<I extends RealID = RealID, V extends Value = Value> {

  /** Physical container */
  container!: Container<this>;

  /** memoized Space */
  _space?: Space;
  get space(): Space {
    if (!this._space) {
      this._space = this.container.space;
    }
    return this._space;
  }

  /** ID of the item within its container */
  id!: I;

  /** memoized Path */
  _path?: Path;
  get path(): Path {
    if (!this._path) {
      this._path = this.container.path.down(this.id);
    }
    return this._path
  }
  get pathString() { return this.path.toString(); }


  /** Logical container: metadata is physically contained in base item, but
   * logically is a peer */
  get up(): Item | undefined {
    return this.container!.up;
  }

  /** iterate upwards through logical containers to Space */
  *upwards(): Generator<Item> {
    for (
      let item: Item = this;
      !(item instanceof Space);
      item = item.container.container
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

  /** whether input or output item */
  isInput = false;

  /** whether item can reject */
  isConditional = false;

  /** Metadata block. Undefined if no metadata */
  metadata?: Metadata;

  /** value of item. Undefined when not yet derived from formula */
  value?: V;

  /** set value */
  setValue(value: Value) {
    assert(!this.value);
    assert(!value.container);
    this.value = value as V;
    value.container = this;
  }

  /** prune value, so it can be set */
  prune() {
    assert(this.value?.container === this);
    this.value.container = undefined as any;
    this.value = undefined;
    // this.rejected = false;
  }

  /** the Item at a downward path else trap */
  down(path: Path): Item {
    let target: Item = this;
    path.ids.forEach(id => {
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
      return this.metadata?.getMaybe(id);
    }

    // evaluate and get from value
    return this.value?.getMaybe(id);
  }

  /** set a metadata field by name. Must not already exist */
  setMeta(name: string, value: Value): Field {
    if (!this.metadata) {
      // allocate metadata block
      this.metadata = new Metadata;
      this.metadata.container = this;
    }
    return this.metadata.set(name, value);
  }

  /** Evaluate metadata and value */
  eval() {

    this.metadata?.eval();

    if (!this.value) {
      // derive value from formula



      // set PendingValue to catch evaluation cycles
      this.setValue(new PendingValue);

      // formula is in ^formula metadata
      const formula = this.get('^formula').value!;
      let value: Value;

      // dereference a Reference
      if (formula instanceof Reference) {
        value = formula.deref(this);
        trap()
      } else {
        // Copy literal value
        value = formula;
      }
      this.prune();
      this.setValue(value.copy(value.path, this.path));
    }

    // evaluate within value
    this.value!.eval();
  }

  /** source of value through copying */
  // FIXME prob should be a Path, translated through copies
  source?: this;

  /** make copy, bottom up, translating paths contextually */
  copy(src: Path, dst: Path): this {
    let to = another(this);
    to.id = this.id;

    to.isInput = this.isInput;
    to.isConditional = this.isConditional;

    // record copy
    to.source = this;

    if (this.space.analyzing) {
      // copy rejection during analysis, which indicates conditionality
      // to.rejected = this.rejected;
    }

    // copy metadata
    if (this.metadata) {
      to.metadata = this.metadata.copy(src, dst);
      to.metadata.container = this;
    }

    // copy value
    if (
      this.value
      && (
        // non-code input values are copied
        (this.isInput && !(this.container instanceof Code))
        // non-literal output values are copied
        || (!this.isInput && !this.getMaybe('^formula'))
      )
    ) {
      to.value = this.value.copy(src, dst);
      to.value.container = this;
    }

    return to;
  }

  // dump value
  dump() { return this.value ? this.value.dump() : {'': 'undefined'}}
}
