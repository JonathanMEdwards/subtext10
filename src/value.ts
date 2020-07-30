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

  /** whether contains an input field with an Anything value */
  abstract get isGeneric(): boolean;

  /** dump into a plain JS value for testing */
  abstract dump(): any;
}
