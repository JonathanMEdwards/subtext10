import { Doc, ID, Path, Container, Value, RealID, Metadata, MetaID, isString, assertDefined, another, Field, Reference, trap, assert, PendingValue } from "./exports";
/**
 * An Item contains a Value. A Value may be a Container of other items. Values
 * that do not container other items are Base vales. This forms a tree. The top
 * item is a Doc. Each contained item carries an ID, and we identify items
 * by the path of IDs down from the top.
 */

export abstract class Item<I extends RealID = RealID, V extends Value = Value> {

  /** Container */
  up!: Container<this>;

  /** memoized Doc */
  _doc?: Doc;
  get doc(): Doc {
    if (!this._doc) {
      this._doc = this.up.doc;
    }
    return this._doc;
  }

  /** ID of the item within its container */
  id!: I;

  /** memoized Path */
  _path?: Path;
  get path(): Path {
    if (!this._path) {
      this._path = this.up.path.down(this.id);
    }
    return this._path
  }

  /** iterate upwards to Doc */
  *upwards() {
    let item: Item = this;
    while (!(item instanceof Doc)) {
      item = item.up.up;
      yield item;
    }
  }

  /** iterate upwards starting with this */
  *thisUpwards() {
    yield this as Item;
    yield* this.upwards();
  }

  /** top-down iteration through all places */
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
    assert(!value.up);
    this.value = value as V;
    value.up = this;
  }

  /** prune value, so it can be set */
  prune() {
    assert(this.value?.up === this);
    this.value.up = undefined as any;
    this.value = undefined;
    this.rejected = false;
  }


  /** the contained item with an ID else undefined */
  get(id: ID): Item | undefined {
    if (
      id instanceof MetaID
      || (isString(id) && id.startsWith('^'))) {
      // metadata access
      return this.metadata?.get(id);
    }

    // evaluate and get from value
    return this.eval().get(id);
  }

  /** get metadata field */
  getMeta(id: ID) {
    return this.metadata?.get(id);
  }
  /** get metadata field value */
  getMetaValue(id: ID) {
    return this.metadata?.get(id)?.eval();
  }

  /** set a metadata field by name. Must not already exist */
  setMeta(name: string, value: Value): Field {
    if (!this.metadata) {
      // allocate metadata block
      this.metadata = new Metadata;
      this.metadata.up = this;
    }
    return this.metadata.set(name, value);
  }

  /** Evaluate the formula stored in metadata to compute value if undefined */
  eval(): V {
    if (this.value) return this.value;

    // set PendingValue to catch evaluation cycles
    this.setValue(new PendingValue);

    /** ^formula contains formula */
    const formula = assertDefined(this.getMetaValue('^formula'));

    if (formula instanceof Reference) {
      formula.deref(this)
       trap()


    }
    // Copy literal value
    this.prune();
    this.setValue(formula.copy(formula.path, this.path));
    return this.value!;
  }

  /** execution status (analysis status during analysis phase) */
  execStatus: undefined | 'pending' | 'done' = undefined;

  /** Execute value. This executes a program block, and evaluates all field in a
   * data block. Also performs analysis */
  exec() {
    switch (this.execStatus) {
      case undefined:
        this.execStatus = 'pending';
        break;
      case 'pending':
        // cyclic execution
        trap();
      case 'done':
        return;
    }

    // evaluate field
    this.eval();

    // TODO: handle rejects and crashes

    // execute value
    this.value!.exec();

    // TODO: hand program rejects and crashes

    this.execStatus = 'done';
    return;
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

    if (this.doc.analyzing) {
      // copy rejection during analysis, which indicates conditionality
      to.rejected = this.rejected;
    }

    // copy metadata
    if (this.metadata) {
      to.metadata = this.metadata.copy(src, dst);
      to.metadata.up = this;
    }

    // copy value of inputs. Non-literal outputs gets re-evaluated
    if (this.value && (this.isInput || !this.getMeta('^formula'))) {
      to.value = this.value.copy(src, dst);
      to.value.up = this;
    }

    return to;
  }

  // dump evaluation
  dump() { return this.eval().dump()}
}
