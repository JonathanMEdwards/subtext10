import { Container, ID, assert, Item, Character, isNumber, isString, Path, another, Value, trap, builtins, Statement, builtinValue } from "./exports";

/** A _Array contains a variable-sized sequence of items of a fixed type. The
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

  // evaluate contents
  eval(): void {
    // eval template
    this.template.eval();
    // eval items
    this.items.forEach(item => item.eval());
  }

  initialize() {
    this.template.initialize();
    this.serial = 0;
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

export const arrayBuiltinDefinitions = `
template = do{in: array{anything}, builtin template}
& = do{in: array{anything}; value: in template(); builtin &; export index = 0}
length = do{in: array{anything}; builtin length}
delete? = do{in: array{anything}; index: 0; builtin delete?}
followed-by = do{in: array{anything}; from: in; builtin followed-by}
at? = do{in: array{anything}; index: 0; builtin at?}
at-or-template = do{in: array{anything}; index: 0; builtin at-or-template}
update? = do{in: array{anything}; index: 0; value: in at-or-template index; builtin update?}
`

/** template */
builtins['template'] = (s: Statement, array: _Array) => {
  s.setFrom(array.template.value!)
}

/** & array add */
builtins['&'] = (s: Statement, array: _Array, value: builtinValue) => {
  let copy = array.copy(array.containingItem.path, s.path);
  s.setValue(copy);
  let entry = new Entry;
  // add to end
  copy.add(entry);
  entry.isInput = true;
  entry.formulaType = 'none';
  if (array.tracked) {
    // assign new serial number
    entry.id = ++copy.serial;
  } else {
    // assign ordinal number
    entry.id = array.items.length;
  }
  entry.setFrom(value);
  // export index
  s.exportFrom(entry.container.items.indexOf(entry) + 1);
}

/** concatenate */
builtins['followed-by'] = (s: Statement, a: _Array, b: _Array) => {
  let copy = a.copy(a.containingItem.path, s.path);
  s.setValue(copy);
  b.items.forEach((item, i) => {
    // renumner id of copy if untracked
    let id = a.tracked ? item.id : a.items.length + i + 1;
    let copiedItem = item.copy(item.path, s.path.down(id));
    copiedItem.id = id;
    copy.add(copiedItem);
  })
}

/** array length */
builtins['length'] = (s: Statement, array: _Array) => {
  s.setFrom(array.items.length);
}

/** delete at index */
builtins['delete?'] = (s: Statement, array: _Array, index: number) => {
  let accepted = 0 < index && index <= array.items.length;
  s.setAccepted(accepted);
  let copy = array.copy(array.containingItem.path, s.path);
  s.setValue(copy);
  if (accepted) {
    copy.items.splice(index - 1, 1);
    if (!array.tracked) {
      // renumber if untracked
      copy.items.slice(index - 1).forEach(item => {
        item.id--;
      })
    }
  }
}

/** array indexing */
builtins['at?'] = (s: Statement, array: _Array, index: number) => {
  let accepted = 0 < index && index <= array.items.length;
  s.setAccepted(accepted);
  s.setFrom((accepted ? array.items[index - 1] : array.template).value!);
}

/** array indexing with failure to template */
builtins['at-or-template'] = (s: Statement, array: _Array, index: number) => {
  s.setFrom((array.items[index - 1] ?? array.template).value!);
}

/** array update */
builtins['update?'] = (
  s: Statement, array: _Array, index: number, value: builtinValue
) => {
  let accepted = 0 < index && index <= array.items.length;
  s.setAccepted(accepted);
  let copy = array.copy(array.containingItem.path, s.path);
  s.setValue(copy);
  if (accepted) {
    let item = copy.items[index - 1];
    item.detachValue();
    item.setFrom(value);
  }
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