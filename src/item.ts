import { ID, Path, Container, trap, Value, RealID, Metadata, MetaID, isString, assertDefined, PathValue, another } from "./exports";
/**
 * An Item contains a Value. A Value may be a Container of other items. Values
 * that do not container other items are Base vales. This forms a tree. The top
 * item is a Document. Each contained item carries an ID, and we identify items
 * by the path of IDs down from the top.
 */

export abstract class Item<I extends RealID = RealID, V extends Value = Value> {

  /** Container */
  up!: Container<this>;

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

  /** whether input or ouput item */
  isInput = true;
  get isOutput() {
    return !this.isInput;
  }

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

  /** Evaluate the formula stored in metadata to compute value if undefined */
  eval(): V {
    if (this.value) return this.value;

    /** ^def is literal, reference, or formula */
    const def = assertDefined(this.get('^def'));

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

    // copy value of inputs. Outputs gets re-evaluated
    if (this.value && this.isInput) {
      to.value = this.value.copy(src, dst);
      to.value.up = this;
    }

    // record copy
    to.source = this;
    return to;
  }

}
