import { Space, ID, Path, Container, Value, RealID, Metadata, MetaID, isString, another, Field, Reference, trap, assert, PendingValue, Code, Token, assertDefined, cast } from "./exports";
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
  // FIXME: report ordinals on anon fields, not serials
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
      item = item.container.item
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
    assert(!value.item);
    this.value = value as V;
    value.item = this;
  }

  /** prune value, so it can be set */
  prune() {
    assert(this.value?.item === this);
    this.value.item = undefined as any;
    this.value = undefined;
    // this.rejected = false;
  }

  /** the Item at a downward path else trap. Accepts a dotted string */
  down(path: Path | string): Item {
    if (path === '') return this;
    let ids = path instanceof Path ? path.ids : path.split('.');
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
      this.metadata.item = this;
    }
    return this.metadata.set(name, value);
  }

  /**
   * How item value is computed. The formula is stored in various metadata
   * fields depending on this tag.
   *
   * none: value is a constant in item.value. Used for literal outputs.
   *
   * literal: value is in ^literal
   *
   * reference: value is target of a Reference in ^reference
   *
   *  */
  formulaType!: 'none' | 'literal' | 'reference';

  /** Evaluates if value undefined, or if inside unexecuted code  */
  evalIfNeeded() {
    if (!this.value) {
      this.eval();
    }
  }

  /** flag that already evaluated, avoiding redundant eval scans. Not strictly
   * necessary, but helps me stop worrying about extra evals */
  evalComplete?: boolean;

  /** Evaluate metadata and value */
  eval() {
    if (this.value) {
      if (this.evalComplete) return;
      // evaluate metadata
      this.metadata?.eval();
    } else {
      // derive value from formula
      assert(!this.evalComplete);

      // set PendingValue to catch evaluation cycles
      this.setValue(new PendingValue);

      // evaluate metadata
      this.metadata?.eval();

      // evaluate formula
      let source: Item;
      switch (this.formulaType) {
        case undefined:
        case 'none':
          trap();
        case 'literal':
          source = this.get('^literal');
          break;
        case 'reference':
          source = assertDefined(
            cast(this.get('^reference').value, Reference).target
          );
          break;
      }

      // copy value
      this.prune();
      this.copyValue(source);
    }

    // evaluate within value
    this.value!.eval();

    this.evalComplete = true;
  }

  /** source of value through copying */
  // FIXME prob should be a Path, translated through copies
  source?: this;

  /** copy value of another item, translating internal paths */
  copyValue(src: Item) {
    this.setValue(src.value!.copy(src.path, this.path));
  }

  /** make copy, bottom up, translating paths contextually */
  copy(src: Path, dst: Path): this {
    let to = another(this);
    to.id = this.id;
    to.formulaType = this.formulaType;
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
      to.metadata.item = this;
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
      to.value.item = this;
    }

    return to;
  }

  // dump value
  dump() { return this.value ? this.value.dump() : {'': 'undefined'}}
}

/** FIXME: reify into state so unaffected items can operate */
export class StaticError extends Error {
  constructor(token: Token, description: string) {
    super(description + ': ' + token.source.slice(token.start, token.end + 10));
  }
}