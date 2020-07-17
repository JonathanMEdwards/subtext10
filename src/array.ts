import { Container, ID, assert, Item, Character, isNumber, isString, Path, another, Value, trap, builtins, Statement, builtinValue, FieldID, Record, Field, Do, cast, Reference, Crash, _Number, StaticError, assertDefined, arrayLast } from "./exports";

/** A _Array contains a variable-sized sequence of items of a fixed type. The
 * items are called entries and have numeric IDs, which are ordinal numbers in
 * an untracked array and serial numbers in a tracked array */
export class _Array<V extends Value = Value> extends Container<Entry<V>> {

  /** whether array is tracked using serial numbers */
  tracked = false;
  /** last used serial number */
  serial = 0;

  /** whether array is sorted by the value of the items */
  sorted = false;
  ascending = true;

  /** Template is item with id 0 */
  template!: Entry<V>;

  /** create template */
  createTemplate(): Entry<V> {
    let template = new Entry<V>();
    this.template = template;
    template.container = this;
    template.isInput = false;
    template.formulaType = 'none';
    template.id = 0;
    return template;
  }

  /** Columns, synthesized on demand, not copied. Note override type by forcing
   * container of column to be an Array not a Record */
  columns: Field[] = [];

  /** the item with an ID else undefined */
  getMaybe(id: ID): Item | undefined {
    if (isNumber(id)) {
      if (id === 0) {
        // template has id 0
        return this.template;
      }
      if (this.tracked) {
        // find serial number if tracked
        return this.items.find(item => item.id === id);
      }
      // use ordinal number if untracked
      return this.items[id - 1];
    }

    // use string as ordinal, even if tracked
    if (isString(id)) {
      let ordinal = Number(id)
      if (Number.isFinite(ordinal)) {
        // convert string to ordinal
        return this.items[ordinal - 1];
      }
    }

    // synthesize column on demand
    if (!(this.template.value instanceof Record)) return undefined;
    const field = this.template.value.getMaybe(id);
    if (!field) return undefined;
    assert(field instanceof Field);
    let column = this.columns.find(column => column.id === field.id);
    if (!column) {
      // synthesize column
      column = new Field();
      column.id = field.id;
      this.columns.push(column);
      // override column container to be Array not Record
      column.container = this as unknown as Container<Field>;
      let columnArray = new _Array;
      column.setValue(columnArray);
      // define column template from record field
      columnArray.createTemplate().setFrom(field);
      // copy field instances into column
      this.items.forEach(entry => {
        let item = entry.get(field.id);
        let copy = new Entry;
        copy.isInput = false;
        copy.formulaType = 'none';
        copy.id = entry.id;
        columnArray.add(copy);
        copy.setFrom(item)
      })
    }
    return column;
  }

  // visit template of array
  *visit(): IterableIterator<Item> {
    yield* super.visit();
    yield* this.template.visit();
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

  // type compatibility requires same type templates
  changeableFrom(from: Value, fromPath?: Path, thisPath?: Path): boolean {
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
    return (
      this.tracked === other.tracked
      && this.sorted === other.sorted
      && this.ascending === other.ascending
      && this.template.equals(other.template)
      && this.serial === other.serial
      && super.equals(other)
    )
  }

  /** whether this is a text-like array */
  get isText() {
    return this.template.value instanceof Character;
  }

  /** returns string value. Traps if not text-like */
  asString(): string {
    assert(this.isText);
    return this.items.map(item => cast(item.value, Character).value).join('');
  }

  // dump as an array
  dump(): any {
    if (this.isText) {
      // dump as a string
      return this.asString();
    }
    return this.items.map(item => item.dump())
  }
}

export class Entry<V extends Value = Value> extends Item<number, V> {
  // return previous item of entire array
  previous(): Item | undefined {
    return this.container.containingItem.previous();
  }

}

/** Text is an untracked array of characters, but is stored as a JS string and
 * expanded into an array on demand */
export class Text extends _Array<Character> {
  tracked = false;
  sorted = false;

  /** JS string value */
  value: string = '';

  get isText() { return true; }
  asText() { return this.value; }

  // synthesize template on demand
  private _template?: Entry<Character>;
  set template(entry: Entry<Character>) {
    this._template = entry;
  }
  get template() {
    if (!this._template) {
      // template is a space character, the default Character
      this.createTemplate().setValue(new Character);
    }
    return this._template!;
  }

  // synthesize items on demand
  private _items?: Entry<Character>[];
  set items(value: Entry<Character>[]) {
    // ignore superclass initialization
    assert(value.length === 0);
  }
  get items() {
    if (!this._items) {
      this._items = Array.from(this.value).map((char, i) => {
        let entry = new Entry<Character>();
        entry.container = this;
        entry.id = i + 1;
        entry.isInput = false;
        entry.formulaType = 'none';
        let value = new Character;
        value.value = char;
        entry.setFrom(value);
        return entry;
      })
    }
    return this._items;
  }

  get isGeneric() { return false; }

  eval() { }

  initialize() { }

  copy(srcPath: Path, dstPath: Path): this {
    // just copy string value
    let to = another(this);
    to.source = this;
    to.value = this.value;
    return to;
  }

  // dump as string
  dump() { return this.value };
}


export const arrayBuiltinDefinitions = `
& = do{in: array{anything}; value: in[]; builtin &; export index = 0}
length = do{in: array{anything}; builtin length}
delete? = do{in: array{anything}; index: 0; builtin delete?}
followed-by = do{in: array{anything}; from: in; builtin followed-by}
at? = do{in: array{anything}; index: 0; builtin at?}
at-or-template = do{in: array{anything}; index: 0; builtin at-or-template}
update? = do{in: array{anything}; index: 0; value: in at-or-template index; builtin update?}
skip-white = do{in: ''; builtin skip-white}
`

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
    entry.id = copy.items.length;
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
  s.setFrom(accepted ? array.items[index - 1] : array.template);
}

/** array indexing with failure to template */
builtins['at-or-template'] = (s: Statement, array: _Array, index: number) => {
  s.setFrom(array.items[index - 1] ?? array.template);
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

builtins['skip-white'] = (s: Statement, a: _Array) => {
  s.setFrom(a.asString().trimStart());
}


/** A Loop iterates a do-block over the input array */
export class Loop extends _Array<Do> {

  /** type of loop */
  loopType!: 'find?' | 'find!' | 'for-all' | 'for-all?' | 'for-all!'
    | 'for-none?' | 'query' | 'accumulate';

  /** input array, set on eval */
  input!: _Array;

  // evaluate contents
  eval(): void {
    // use template evaluation bit to signify eval of whole loop
    if (this.template.evaluated) return;
    // eval template
    this.template.eval();
    let templateBlock = this.template.value!;
    // get input array
    let inputTemplate =
      cast(templateBlock.items[0].get('^reference').value, Reference).target!;
    assert(inputTemplate.id === 0);
    assert(inputTemplate.container instanceof _Array);
    this.input = inputTemplate.container;

    if (this.loopType === 'accumulate' && this.workspace.analyzing) {
      // TODO: type check accumulator and result
      let accum = templateBlock.items[1];
      let result = templateBlock.result!;
      if (!accum.value!.changeableFrom(result.value!)) {
        throw new StaticError(accum.value!.token, 'result must be same type as accumulator')
      }
    }

    // iterate over input array
    this.input.items.forEach(item => {
      let iteration = new Entry<Do>();
      this.add(iteration);
      iteration.id = item.id;
      iteration.isInput = false;
      iteration.formulaType = 'none';
      // copy code block into iteration
      iteration.setFrom(templateBlock);
      // set input item of code block
      let iterInput = iteration.value!.items[0];
      assert(iterInput.isInput);
      iterInput.detachValue();
      iterInput.setFrom(item);

      if (this.loopType === 'accumulate' && item !== this.input.items[0]) {
        // set previous result into accumulater
        let prev = cast(this.items[this.items.length - 2].value, Do);
        let accum = iteration.value!.items[1];
        assert(accum.isInput);
        accum.detachValue();
        accum.setFrom(prev.result)
      }

      // evaluate iteration
      iteration.eval();
    })
  }

  /** extract results of a loop into a statement */
  execute(statement: Statement) {
    let guarded = this.loopType.endsWith('?');
    statement.setConditional(guarded);
    let templateBlock = this.template.value!;

    switch (this.loopType) {
      case 'find?':
      case 'find!':
        // find first non-rejecting block
        if (!templateBlock.conditional) {
          throw new StaticError(templateBlock.token, 'block must be conditional');
        }
        let index = 0;
        if (!this.workspace.analyzing) {
          index =
            this.items.findIndex(iteration => !iteration.value!.rejected) + 1;
          if (!index) {
            if (!guarded) {
              throw new Crash(this.token, 'assertion failed')
            }
            statement.rejected = true;
          }
        }
        let item = index ? this.items[index - 1] : this.template;
        // use input item from block
        statement.setFrom(item.value!.items[0])
        // export index
        let indexField = new Field;
        // copy fieldID of index export from at function
        // TODO: define this statically
        indexField.id = cast(
          this.workspace.currentVersion.down('builtins.at.^code.index').id,
          FieldID);
        indexField.isInput = false;
        indexField.formulaType = 'none';
        indexField.setFrom(index);
        let indexRecord = new Record;
        indexRecord.add(indexField);
        let exportField = statement.replaceMeta('^export', indexRecord);
        exportField.setConditional(guarded);
        return;

      case 'for-all':
      case 'for-all?':
      case 'for-all!':
      case 'query':
        if (this.loopType === 'for-all') {
          if (templateBlock.conditional) {
            throw new StaticError(templateBlock.token, 'block cannot be conditional');
          }
        } else if (this.loopType === 'query') {
        } else if (!templateBlock.conditional) {
          throw new StaticError(templateBlock.token, 'block must be conditional');
        }

        // create result array
        let resultArray = new _Array;
        statement.setFrom(resultArray);
        resultArray.tracked = this.input.tracked;
        resultArray.sorted = false;
        // define template from result of template block
        // note template blocks execute to completion even if rejecting
        resultArray.createTemplate().setFrom(templateBlock.result);

        // copy results of loop into result array
        this.items.forEach(iteration => {
          let iterationBlock = assertDefined(iteration.value);
          if (iterationBlock.rejected) {
            if (this.loopType === 'for-all?') {
              // reject whole function
              statement.rejected = true;
            } else if (
              this.loopType === 'for-all!'
              && !this.workspace.analyzing
            ) {
              // failed assertion
              throw new Crash(this.token, 'assertion failed')
            }
            // skip rejections
            return;
          }
          let resultItem = new Entry;
          resultArray.add(resultItem);
          if (resultArray.tracked) {
            // copy ID from tracked array
            resultItem.id = iteration.id;
          } else {
            // set ordinals if untracked
            resultItem.id = resultArray.items.length;
          }
          resultItem.isInput = false;
          resultItem.formulaType = 'none';
          resultItem.setFrom(iterationBlock.result);
        })
        return;

      case 'for-none?':
        if (!templateBlock.conditional) {
          throw new StaticError(templateBlock.token, 'block must be conditional');
        }

        // reject if any iteration succeeded
        if (this.items.find(iteration => !iteration.value!.rejected)) {
          statement.rejected = true;
        }

        // copy input array to result
        statement.setFrom(this.input);
        return;

      case 'accumulate':
        if (templateBlock.conditional) {
          throw new StaticError(templateBlock.token, 'block cannot be conditional');
        }
        if (this.items.length) {
          // return last result
          statement.setFrom(arrayLast(this.items).value!.result)
        } else {
          // return initial accumulator value
          statement.setFrom(templateBlock.items[1]);
        }
        return;

      default: trap();
    }
  }

  copy(srcPath: Path, dstPath: Path): this {
    // suppress copying iterations - they will be recomputed
    let items = this.items;
    this.items = [];
    let to = super.copy(srcPath, dstPath);
    this.items = items;
    to.loopType = this.loopType;
    return to;
  }
}