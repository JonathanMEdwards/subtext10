import { Container, ID, assert, Item, Character, isNumber, isString, Path, another } from "./exports";

/** A Series contains a variable-zed sequence of items of a fixed type. The
 * items are called entries and have numeric IDs, which are ordinal numbers in
 * an untracked series and serial numbers in a tracked series */
export class Series<E extends Entry = Entry> extends Container<E> {

  /** whether series is tracked using serial numbers */
  tracked = false;

  /** whether series is sorted by the value of the items */
  sorted = false;
  ascending = true;

  /** Template is entry with id=NaN */
  template!: E;

  // items are entries
  get entries() {
    return this.items;
  }

  /** the item with an ID else undefined */
  get(id: ID): E | undefined {
    if (isNumber(id)) {
      if (this.tracked) {
        // find serial numner
        return this.entries.find(entry => entry.id === id);
      }
      // use ordinal number
      return this.entries[id - 1];
    }
    // use string as ordinal
    assert(isString(id));
    let ordinal = Number(id)
    if (Number.isFinite(ordinal)) {
      // convert string to ordinal
      return this.entries[ordinal - 1];
    }
    return undefined;
  }

  // execute contents
  exec(): void {
    // exec template
    this.template.exec();
    // exec entries
    super.exec();
  }

  copy(src: Path, dst: Path): this {
    let to = super.copy(src, dst);
    to.tracked = this.tracked;
    to.sorted = this.sorted;
    to.ascending = this.ascending;
    to.template = this.template.copy(src, dst);
    to.template.up = this;
    return to;
  }

  // dump as an array
  dump(): any {
    return this.entries.map(entry => entry.dump())
  }
}

/** Entry is an Item with a numeric ID */
export class Entry extends Item<number> {
}


/** Text is an untracked series of characters, but is stored as a JS string and
 * expanded into a series on demand */
export class Text extends Series<TextEntry> {
  tracked = false;
  sorted = false;

  /** JS string value */
  value: string = '';

  copy(src: Path, dst: Path): this {
    // just copy string value
    let to = another(this);
    to.source = this;
    to.value = this.value;
    return to;
  }

  // dump as string
  dump() { return this.value };
}

export class TextEntry extends Item<number, Character> {

}