import { Workspace, Item, trap, ID, Path, another, Token, assert, assertDefined, Version } from "./exports";

/** Every Value is contained in an Item */
export abstract class Value {

  /** Item containing this value */
  containingItem!: Item;
  /** Path of containing item */
  get containingPath() { return this.containingItem.path; }

  get version(): Version { return this.containingItem.version}
  get workspace(): Workspace { return this.containingItem.workspace }
  get analyzing() { return this.workspace.analyzing; }

  get id(): ID { return this.containingItem.id }

  /** logical container (skipping base field of metadata) */
  get up(): Item {
    return this.containingItem;
  }

  /** the item with an ID */
  get(id: ID): Item {
    return assertDefined(this.getMaybe(id));
  }

  /** the item with an ID else undefined */
  getMaybe(id: ID): Item | undefined {
    return undefined;
  }

  /** source token where defined */
  token?: Token;

  /** true if this is the designated blank value for the type */
  abstract isBlank(): boolean;

  /** evaluate contents */
  abstract eval(): void;

  /** unevaluate */
  abstract uneval(): void;

  /** source of value through copying */
  source?: this;

  /** original source of this value via copying. That is, its definition */
  get origin(): this {
    return this.source ? this.source.origin : this;
  }

  /** edit error stored in containing Item */
  get editError() { return this.containingItem.editError }
  /** propagate error to containing item */
  propagateError(from: Item | Value) {
    this.containingItem.propagateError(from);
  }

  /** make copy, bottom up, translating paths contextually */
  copy(srcPath: Path, dstPath: Path): this {
    let to = another(this);
    to.source = this;
    to.token = this.token;
    return to;
  }

  /** type compatibility */
  updatableFrom(from: Value, fromPath?: Path, thisPath?: Path): boolean {
    return this.constructor === from.constructor;
  }

  /** value equality, assuming type equality */
  equals(other: any): boolean {
    trap();
  }

  /** whether this value was transitively copied from another Value without any
   * updates. Only used during analysis */
  isCopyOf(ancestor: this): boolean {
    assert(this.analyzing);
    if (!this.source) return false;
    // check if our source is a copy
    return this.source === ancestor || this.source.isCopyOf(ancestor)
  }

  /** static equality check. During analysis uses ifCopyOf, otherwise equals */
  staticEquals(other: this): boolean {
    return this.analyzing ? this.isCopyOf(other) : this.equals(other);
  }

  /** whether contains an input field with an Anything value */
  get isGeneric() { return false }

  /** dump into a plain JS value for testing */
  abstract dump(): any;
}
