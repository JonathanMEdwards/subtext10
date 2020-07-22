import { assert, Item, Value, another, Path, MetaID } from "./exports";

/** superclass of Block and _Array, the two kinds of containers. */
export abstract class Container<I extends Item> extends Value {

  /** array of items in proper order */
  items: I[] = [];

  /** top-down iteration through all items */
  *visit(): IterableIterator<Item> {
    for (let item of this.items) {
      yield* item.visit();
    }
  }


  /** add an item to end */
  add(item: I) {
    assert(!item.container);
    item.container = this;
    this.items.push(item);
  }

  /** make copy, bottom up, translating paths contextually */
  copy(srcPath: Path, Path: Path): this {
    let to = super.copy(srcPath, Path);
    this.items.forEach(item => {
      assert(item.container === this);
      if (item.id instanceof MetaID && item.id.dynamic) {
        // don't copy dynamic metadata
        return;
      }
      to.add(item.copy(srcPath, Path));
    })
    return to;
  }

  /** value equality */
  equals(other: any) {
    return (
      other instanceof Container
      && this.items.length === other.items.length
      && this.items.every(
        // TODO: only need to check input items
        (item, i) => item.equals(other.items[i])
      )
    )
  }
}