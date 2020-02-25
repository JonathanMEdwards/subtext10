import { Container, ID, assert, Item, Character, isNumber, isString, Path, another, Value, trap } from "./exports";

/** A Series contains a variable-zed sequence of items of a fixed type. The
 * items are called entries and have numeric IDs, which are ordinal numbers in
 * an untracked series and serial numbers in a tracked series */
export class Series<E extends Entry = Entry> extends Container<E> {

  /** whether series is tracked using serial numbers */
  tracked = false;

  /** whether series is sorted by the value of the items */
  sorted = false;
  ascending = true;

  /** Template is entry with id 0 */
  template!: E;

  // items are entries
  get entries() {
    return this.items;
  }

  /** the item with an ID else undefined */
  getMaybe(id: ID): E | undefined {
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

  // evaluate contents
  eval(): void {
    // eval template
    this.template.eval();
    // eval entries
    this.entries.forEach(entry => entry.eval());
  }

  initialize() {
    this.template.initialize();
    this.items = [];
  }

  copy(srcPath: Path, dstPath: Path): this {
    let to = super.copy(srcPath, dstPath);
    to.tracked = this.tracked;
    to.sorted = this.sorted;
    to.ascending = this.ascending;
    assert(this.template.container === this);
    to.template = this.template.copy(srcPath, dstPath);
    to.template.container = this;
    return to;
  }

  changeableFrom(from: Value, fromPath: Path, thisPath: Path): boolean {
    return (
      from instanceof Series
      && this.template.changeableFrom(from.template, fromPath, thisPath)
    )
  }

  get isGeneric() {
    return this.template.value!.isGeneric;
  }

  /** value equality */
  equals(other: Series) {
    assert(!(other instanceof Text))
    return (
      this.tracked == other.tracked
      && this.sorted == other.sorted
      && this.ascending == other.ascending
      && this.template.equals(other.template)
      && super.equals(other)
    )
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

  eval() { }

  initialize() { }

  copy(srcPath: Path, dstPath: Path): this {
    // just copy string value
    let to = another(this);
    to.source = this;
    to.value = this.value;
    return to;
  }

  get isGeneric() { return false; }

  changeableFrom(from: Value, fromPath: Path, thisPath: Path): boolean {
    // FIXME: compatible Series
    return from instanceof Text
  }


  /** value equality */
  equals(other: Series): boolean {
    if (other instanceof Text) {
      return this.value === other.value;
    }
    // FIXME: Text-Series equality
    trap();
  }

  // dump as string
  dump() { return this.value };
}

export class TextEntry extends Item<number, Character> {

}