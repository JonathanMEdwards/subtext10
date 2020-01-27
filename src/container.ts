import { Item, Value, another, Path } from "./exports";
import { assert } from "./util";

/** superclass of Block and Series, the two kinds of containers. */
export abstract class Container<I extends Item> extends Value {

  /** array of items in proper order */
  items: I[] = [];

  /** add an item to end */
  add(item: I) {
    assert(!item.up);
    item.up = this;
    this.items.push(item);
  }

  /** make copy, bottom up, translating paths contextually */
  copy(src: Path, dst: Path): this {
    let to = super.copy(src, dst);
    this.items.forEach(item => {
      to.add(item.copy(src, dst));
    })
    return to;
  }


}