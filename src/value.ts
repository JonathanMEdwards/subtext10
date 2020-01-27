import { Item, trap, ID, Field, Path, another } from "./exports";

/** Every Value is contained in an Item */
export abstract class Value {

  /** containing Item */
  up!: Item;

  get path() {
    return this.up.path;
  }

  /** the item with an ID else undefined */
  get(id: ID): Item | undefined {
    return undefined;
  }

  /** source of value through copying */
  source?: this;

  /** make copy, bottom up, translating paths contextually */
  copy(src: Path, dst: Path): this {
    let to = another(this);
    to.source = this;
    return to;
  }

  /** equality */
  equals(other: any): boolean {
    trap();
  }
}
