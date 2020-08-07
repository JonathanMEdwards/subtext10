import { Workspace, Item, trap, ID, Path, another, Token } from "./exports";

/** Every Value is contained in an Item */
export abstract class Value {

  /** Item containing this value */
  containingItem!: Item;
  get workspace(): Workspace { return this.containingItem.workspace }
  get id(): ID { return this.containingItem.id }

  /** logical container (skipping base field of metadata) */
  get up(): Item {
    return this.containingItem;
  }

  /** the item with an ID else undefined */
  getMaybe(id: ID): Item | undefined {
    return undefined;
  }

  /** source token where defined */
  token?: Token;

  /** evaluate contents */
  abstract eval(): void;

  /** initialize all values */
  abstract initialize(): void;

  /** source of value through copying */
  source?: this;

  /** original source of this value via copying. That is, its definition */
  get origin(): this {
    return this.source ? this.source.origin : this;
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
   * updates */
  isCopyOf(ancestor: this): boolean {
    if (!this.source) return false;
    // check if our source is a copy
    return this.source === ancestor || this.source.isCopyOf(ancestor)
  }

  /** static equality check. During analysis uses ifCopyOf, otherwise equals */
  staticEquals(other: this): boolean {
    return this.workspace.analyzing ? this.isCopyOf(other) : this.equals(other);
  }

  /** whether contains an input field with an Anything value */
  abstract get isGeneric(): boolean;

  /** dump into a plain JS value for testing */
  abstract dump(): any;
}
