import { Space, Item, trap, ID, Path, another, Token } from "./exports";

/** Every Value is contained in an Item */
export abstract class Value {

  /** Item containing this value */
  containingItem!: Item;
  get space(): Space { return this.containingItem.space }
  get id(): ID { return this.containingItem.id }

  /** logical container (skipping base field of metadata) */
  get up(): Item | undefined {
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

  /** source of value through copying */
  source?: this;

  /** make copy, bottom up, translating paths contextually */
  copy(src: Path, dst: Path): this {
    let to = another(this);
    to.source = this;
    to.token = this.token;
    return to;
  }

  /** equality */
  equals(other: any): boolean {
    trap();
  }

  /** dump into a plain JS value for testing */
  abstract dump(): any;
}
