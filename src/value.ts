import { Doc, Item, trap, ID, Path, another, Token } from "./exports";

/** Every Value is contained in an Item */
export abstract class Value {

  /** containing Item */
  up!: Item;

  /** containing doc */
  get doc(): Doc { return this.up.doc }

  get path() {
    return this.up.path;
  }

  /** the item with an ID else undefined */
  get(id: ID): Item | undefined {
    return undefined;
  }

  /** source token where defined */
  token?: Token;

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
