import { Container, ID, assert, Item, Character, isNumber, isString, Path, another, Value, trap, Statement } from "./exports";

/** A SArray contains a variable-sized sequence of items of a fixed type. The
 * items are called entries and have numeric IDs, which are ordinal numbers in
 * an untracked array and serial numbers in a tracked array */
export class _Array<V extends Value = Value> extends Container<Entry<V>> {

  /** whether array is tracked using serial numbers */
  tracked = true;
  /** last used serial number */
  serial = 0;

  /** whether array is sorted by the value of the items */
  sorted = false;
  ascending = true;

  /** Template is item with id 0 */
  template!: Entry<V>;

  /** the item with an ID else undefined */
  getMaybe(id: ID): Entry<V> | undefined {
    if (id === 0 || id === '0') {
      // template access
      return this.template;
    }
    if (isNumber(id)) {
      if (this.tracked) {
        // find serial number if tracked
        return this.items.find(item => item.id === id);
      }
      // use ordinal number if untracked
      return this.items[id - 1];
    }
    // use string as ordinal, even if tracked
    assert(isString(id));
    let ordinal = Number(id)
    if (Number.isFinite(ordinal)) {
      // convert string to ordinal
      return this.items[ordinal - 1];
    }
    return undefined;
  }

  /** adds value to array and sets into item */
  addInto(item: Item, value: V): Entry {
    let copy = this.copy(this.containingItem.path, this.containingItem.path);
    item.setValue(copy);
    let entry = new Entry<V>();
    // add to end
    copy.add(entry);
    entry.isInput = true;
    entry.formulaType = 'none';
    entry.setFrom(value);
    if (this.tracked) {
      // assign new serial number
      entry.id = ++copy.serial;
    } else {
      // assign ordinal number
      entry.id = this.items.length;
    }
    return entry;
  }


  // evaluate contents
  eval(): void {
    // eval template
    this.template.eval();
    // eval items
    this.items.forEach(item => item.eval());
  }

  initialize() {
    this.template.initialize();
    this.items = [];
  }

  copy(srcPath: Path, dstPath: Path): this {
    let to = super.copy(srcPath, dstPath);
    to.tracked = this.tracked;
    to.serial = this.serial;
    to.sorted = this.sorted;
    to.ascending = this.ascending;
    assert(this.template.container === this);
    to.template = this.template.copy(srcPath, dstPath);
    to.template.container = to;
    return to;
  }

  changeableFrom(from: Value, fromPath: Path, thisPath: Path): boolean {
    return (
      from instanceof _Array
      && this.template.changeableFrom(from.template, fromPath, thisPath)
    )
  }

  get isGeneric() {
    return this.template.value!.isGeneric;
  }

  /** value equality */
  equals(other: _Array) {
    assert(!(other instanceof Text))
    return (
      this.tracked === other.tracked
      && this.sorted === other.sorted
      && this.ascending === other.ascending
      && this.template.equals(other.template)
      && this.serial === other.serial
      && super.equals(other)
    )
  }

  // dump as an array
  dump(): any {
    return this.items.map(item => item.dump())
  }
}

export class Entry<V extends Value = Value> extends Item<number, V> {
  private _nominal: undefined;
}

/** Text is an untracked array of characters, but is stored as a JS string and
 * expanded into a array on demand */
export class Text extends _Array<Character> {
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
    // FIXME: compatible array
    return from instanceof Text
  }


  /** value equality */
  equals(other: _Array): boolean {
    if (other instanceof Text) {
      return this.value === other.value;
    }
    // FIXME: Text-array equality
    trap();
  }

  // dump as string
  dump() { return this.value };
}