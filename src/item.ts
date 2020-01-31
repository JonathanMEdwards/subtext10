import { Doc, ID, Path, Container, Value, RealID, Metadata, MetaID, isString, assertDefined, another, Field } from "./exports";
/**
 * An Item contains a Value. A Value may be a Container of other items. Values
 * that do not container other items are Base vales. This forms a tree. The top
 * item is a Doc. Each contained item carries an ID, and we identify items
 * by the path of IDs down from the top.
 */

export abstract class Item<I extends RealID = RealID, V extends Value = Value> {

  /** Container */
  up!: Container<this>;

  /** containing Doc */
  get doc(): Doc { return this.up.doc }

  /** ID of the item within its container */
  id!: I;

  /** memoized Path */
  private _path?: Path;
  get path(): Path {
    if (!this._path) {
      this._path = this.up.path.down(this.id);
    }
    return this._path
  }

  /** whether input or output item */
  isInput = false;

  /** whether item can reject */
  isConditional = false;

  /** Metadata block. Undefined if no metadata */
  metadata?: Metadata;

  /** value of item. Undefined when not yet derived from formula */
  value?: V;

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

    /** ^def is literal, reference, or formula */
    const def = assertDefined(this.getMeta('^def'));

    // assume literal for now. Copy value
    this.value = def.eval().copy(def.path, this.path) as V;
    this.value.up = this;

    return this.value;
  }

  /** source of value through copying */
  source?: this;

  /** make copy, bottom up, translating paths contextually */
  copy(src: Path, dst: Path): this {
    let to = another(this);
    to.id = this.id;

    // copy metadata
    if (this.metadata) {
      to.metadata = this.metadata.copy(src, dst);
      to.metadata.up = this;
    }

    // copy value of inputs. Non-literal outputs gets re-evaluated
    if (this.value && (this.isInput || !this.getMeta('^def'))) {
      to.value = this.value.copy(src, dst);
      to.value.up = this;
    }

    to.isInput = this.isInput;
    to.isConditional = this.isConditional;

    // record copy
    to.source = this;
    return to;
  }

  // dump evaluation
  dump() { return this.eval().dump()}
}
