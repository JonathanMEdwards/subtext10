import { Container, ID, assert, Item, Character, isNumber, isString, Path, another, Value, trap, builtins, Statement, builtinValue, FieldID, Record, Field, Do, cast, Reference, Crash, _Number, CompileError, assertDefined, arrayLast, arrayEquals, Token } from "./exports";

/** A _Array contains a variable-sized sequence of items of a fixed type. The
 * items are called entries and have numeric IDs, which are ordinal numbers in
 * an untracked array and serial numbers in a tracked array */
export class _Array<V extends Value = Value> extends Container<Entry<V>> {

  /** whether array is tracked using serial numbers */
  tracked = false;
  /** last used serial number. During analysis counts creates and deletes */
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
    template.io = 'data';
    template.formulaType = 'none';
    template.id = 0;
    return template;
  }

  /** ghost items. Only used when updating a tracked array through a for-all.
   * Contains entries with ids greater than the serial #. These are created in
   * response to creations in the result of a for-all on the array. A
   * corresponding ghost entry will be created in the for-all Loop, which is
   * updated by the creation and feeds back into this array */
  // FIXME: this smells. Reify conditional/deleted entries?
  ghosts!: Entry<V>[];

  createGhost(id: number): Entry<V> {
    assert(id > this.serial);
    let entry: Entry<V> = new Entry;
    entry.id = id;
    if (!this.ghosts) {
      this.ghosts = [];
    }
    // remove an existing ghost to allow speculative feedbacks
    let existing = this.ghosts.findIndex(item => item.id === id);
    if (existing !== -1) {
      this.ghosts.splice(existing, 0);
    }
    this.ghosts.push(entry);
    entry.container = this;
    entry.io = 'data';
    entry.formulaType = 'none';
    entry.setFrom(this.template);
    return entry;
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
        if (id > this.serial && this.ghosts) {
          // ghost item
          return this.ghosts.find(item => item.id === id);
        }
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
        if (ordinal === 0) {
          return this.template;
        }
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
        copy.io = 'output';
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

  // array is blank when it is empty
  isBlank() { return this.items.length === 0 }

  uneval() {
    this.template.uneval();
    // previously was initializing arrays
    // this.serial = 0;
    // this.items = [];
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
  updatableFrom(from: Value, fromPath?: Path, thisPath?: Path): boolean {
    return (
      from instanceof _Array
      && this.template.updatableFrom(from.template, fromPath, thisPath)
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

  /** whether this value was transitively copied from another Value without any
    * updates. Template must be a copy and serial #s match. During analysis
    * deletes also increment the serial #. */
  isCopyOf(ancestor: this): boolean {
    return (
      ancestor instanceof _Array
      && this.template.value!.isCopyOf(ancestor.template.value!)
      && this.serial === ancestor.serial
      && super.isCopyOf(ancestor)
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

  // Workaround in TS 4 to override property with accessor
  // Really this is perf op so should just eagerly synthesize
  constructor() {
    super();
    Object.defineProperty(this, "template", {
      // synthesize template on demand
      get() {
        if (!this._template) {
          // template is a space character, the default Character
          this.createTemplate().setValue(new Character);
        }
        return (this as Text)._template!;
      },
      set(entry: Entry<Character>) {
        this._template = entry;
      }
    })
    Object.defineProperty(this, "items", {
      // synthesize items on demand
      get() {
        if (!this._items) {
          this._items = Array.from(this.value as string).map((char, i) => {
            let entry = new Entry<Character>();
            entry.container = this;
            entry.id = i + 1;
            entry.io = 'output';
            entry.formulaType = 'none';
            let value = new Character;
            value.value = char;
            entry.setFrom(value);
            return entry;
          })
        }
        return (this as Text)._items;
      },
      set(value: Entry<Character>[]) {
        // ignore superclass initialization
        assert(value.length === 0);
        trap();
      }
    })
  }


  tracked = false;
  sorted = false;

  /** JS string value */
  value: string = '';

  get isText() { return true; }
  asText() { return this.value; }

  // synthesize template on demand
  private _template?: Entry<Character>;

  // synthesize items on demand
  private _items?: Entry<Character>[];

  get isGeneric() { return false; }

  eval() { }

  uneval() { }

  copy(srcPath: Path, dstPath: Path): this {
    // just copy string value
    let to = another(this);
    to.source = this;
    to.value = this.value;
    if (this.analyzing) {
      // copy template during analysis to track copying
      to.createTemplate().setValue(this.template.value!.copy(srcPath, dstPath));
    }
    return to;
  }

  // dump as string
  dump() { return this.value };
}




/** A Loop iterates a do-block over the input array */
export class Loop extends _Array<Do> {

  /** type of loop */
  loopType!: 'find?' | 'find!' | 'for-all' | 'such-that' | 'all?' | 'all!'
    | 'none?' | 'none!' | 'accumulate' | 'selecting';

  /** input array, set on eval */
  input!: _Array;

  // evaluate contents
  eval(): void {
    // use template evaluation bit to signify eval of whole loop
    if (this.template.evaluated) return;
    // eval template
    this.template.eval();
    let templateBlock = this.template.value!;
    const blockInput = templateBlock.items[0];
    // Input of loop template block is reference to source array template
    blockInput.used = true;
    let sourceTemplate =
      cast(blockInput.get('^reference').value, Reference).target!;
    assert(sourceTemplate.id === 0);
    assert(sourceTemplate.container instanceof _Array);
    this.input = sourceTemplate.container;

    // mimic tracking of input array
    this.tracked = this.input.tracked;
    this.serial = this.input.serial;

    if (this.loopType === 'accumulate' && this.analyzing) {
      // TODO: type check accumulator and result
      let accum = templateBlock.items[1];
      let result = templateBlock.result!;
      if (!accum.value!.updatableFrom(result.value!)) {
        throw new CompileError(accum.value!.token, 'result must be same type as accumulator')
      }
    }

    // iterate over input array
    this.input.items.forEach(item => {
      let iteration = new Entry<Do>();
      this.add(iteration);
      iteration.id = item.id;
      iteration.io = 'output';
      iteration.formulaType = 'none';
      // copy code block into iteration
      iteration.setFrom(templateBlock);
      iteration.uneval();
      // set iteration source reference to source entry
      let iterInput = iteration.value!.items[0];
      assert(iterInput.formulaType === 'reference');
      let iterRef = cast(iterInput.get('^reference').value, Reference);
      assert(arrayLast(iterRef.path.ids) === 0);
      iterRef.path = item.path;
      assert(!iterRef.target);

      if (this.loopType === 'accumulate' && item !== this.input.items[0]) {
        // set previous result into accumulater
        let prev = cast(this.items[this.items.length - 2].value, Do);
        let accum = iteration.value!.items[1];
        assert(accum.io === 'input');
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


      // find first non-rejecting block
      case 'find?':
      case 'find!': {
        if (!templateBlock.conditional) {
          throw new CompileError(templateBlock.token, 'block must be conditional');
        }
        let index = 0;
        if (!this.analyzing) {
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
        indexField.io = 'output';
        indexField.formulaType = 'none';
        indexField.setFrom(index);
        let indexRecord = new Record;
        indexRecord.add(indexField);
        let exportField = statement.replaceMeta('^export', indexRecord);
        exportField.setConditional(guarded);
        return;
      }


      // map an array through a function
      case 'for-all': {
        if (templateBlock.conditional) {
          throw new CompileError(templateBlock.token,
            'block cannot be conditional');
        }

        // create result array
        let resultArray = new _Array;
        statement.setFrom(resultArray);
        resultArray.tracked = this.input.tracked;
        resultArray.serial = this.input.serial;
        // result isn't sorted FIXME: should it be?
        resultArray.sorted = false;
        // define template from result of template block
        /** This is the reason we can't combine filtering with mapping: the
         * filter might reject the template of the source. We could allow this,
         * and use the value produced by the rejected filter, but that would
         * require documenting what every conditional functional does in that
         * case. Not worth the doc overhead */
        resultArray.createTemplate().setFrom(templateBlock.result);

        // copy results of loop into result array
        this.items.forEach(iteration => {
          let iterationBlock = assertDefined(iteration.value);
          let resultItem = new Entry;
          resultArray.add(resultItem);
          if (resultArray.tracked) {
            // copy ID from tracked array
            resultItem.id = iteration.id;
          } else {
            // set ordinals if untracked
            resultItem.id = resultArray.items.length;
          }
          resultItem.io = 'input';
          resultItem.formulaType = 'none';
          resultItem.setFrom(iterationBlock.result);
        })
        return;
      }


      // filter
      case 'such-that': {

        if (!templateBlock.conditional) {
          throw new CompileError(templateBlock.token,
            'block must be conditional');
        }

        // create result array
        let resultArray = new _Array;
        statement.setFrom(resultArray);
        resultArray.tracked = this.input.tracked;
        resultArray.serial = this.input.serial;
        resultArray.sorted = this.input.sorted;
        // copy source template
        resultArray.createTemplate().setFrom(this.input.template);

        // copy source items into result array when not rejected
        this.items.forEach((iteration, i) => {
          let iterationBlock = assertDefined(iteration.value);
          if (iterationBlock.rejected) {
            // skip rejections
            return;
          }
          let resultItem = this.input.items[i].copy(
            this.input.containingPath, statement.path);
          resultArray.add(resultItem);
          if (!resultArray.tracked) {
            // set ordinals if untracked
            resultItem.id = resultArray.items.length;
          }
        })
        return;
      }


      // selection
      case 'selecting': {

        if (!templateBlock.conditional) {
          throw new CompileError(templateBlock.token,
            'block must be conditional');
        }

        // copy result from source selection
        // get source selection from input array, which is selection.backing
        let selection = this.input.containingItem.container;
        if (!(selection instanceof Selection)) {
          throw new CompileError(statement,
            'selecting block requires a selection');
        }
        statement.setFrom(selection);
        let result = statement.value as Selection;
        result.selected = [];

        // select unrejected array items
        this.items.forEach((iteration, i) => {
          let iterationBlock = assertDefined(iteration.value);
          if (iterationBlock.rejected) {
            // skip rejections
            return;
          }
          result.selected.push(iteration.id);
        })
        return;
      }


      // test filtering
      case 'all?':
      case 'all!':
      case 'none?':
      case 'none!': {

        const all = this.loopType.startsWith('all');
        if (!templateBlock.conditional) {
          throw new CompileError(templateBlock.token, 'block must be conditional');
        }
        // reject if any/no iteration succeeded
        if (this.items.find(iteration => {
          let rejected = iteration.value!.rejected;
          return all ? rejected : !rejected
        })) {
          statement.rejected = true;
          if (this.loopType.endsWith('!') && !this.analyzing) {
            // failed assertion
            throw new Crash(this.token, 'assertion failed')
          }
        }

        // copy input array to result
        statement.setFrom(this.input);
        return;
      }


      case 'accumulate': {
        if (templateBlock.conditional) {
          throw new CompileError(templateBlock.token, 'block cannot be conditional');
        }
        if (this.items.length) {
          // return last result
          statement.setFrom(arrayLast(this.items).value!.result)
        } else {
          // return initial accumulator value
          statement.setFrom(templateBlock.items[1]);
        }
        return;
      }


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

/** Selection subclasses Reference to the backing array */
export class Selection extends Reference {

  /** the backing array */
  get backing() {
    return this.target!.value as _Array;
  }

  /** whether this is a generic selection */
  generic = false;
  get isGeneric() {
    return this.generic;
  }

  /** selected tracking ids in backing array. Sorted numerically. TODO: sort by
   * position if array reorderable */
  selected: number[] = [];

  // selection is blank when nothing is selected
  isBlank() { return this.selected.length === 0 }

  /** 1-based indexes of selected items in base array */
  get indexes() {
    return this.selected.map(id =>
      this.backing.items.findIndex(item => item.id === id) + 1)
  }

  // select an id
  select(id: number) {
    this.eval()
    let selected = this.selected;
    if (selected.indexOf(id) >= 0) {
      // already selected
      return;
    }
    assert(this.backing.getMaybe(id));
    // insert in sort order
    let index = selected.findIndex(existing => existing > id);
    if (index < 0) {
      index = selected.length;
    }
    selected.splice(index, 0, id);
  }

  // deselect an id
  deselect(id: number) {
    this.eval()
    let index = this.selected.indexOf(id);
    if (index < 0) {
      // not selected
      return;
    }
    this.selected.splice(index, 1);
  }

  eval() {
    // bind array reference
    super.eval();
    if (this.conditional) {
      throw new CompileError(this.containingItem,
        'selection reference can not be conditional')
    }
    this.postEval();
  }

  // eval for Selection
  protected postEval() {
    let array = this.target!.value!;
    if (this.analyzing) {
      if (!(array instanceof _Array)) {
        throw new CompileError(this.containingItem,
          'selection requires an array reference')
      }
      if (!array.tracked) {
        throw new CompileError(this.containingItem,
          'selection requires a tracked array')
      }
    }
    // auto-delete missing selections in an input field
    if (this.containingItem.inputLike) {
      this.selected = this.selected.filter(id => array.getMaybe(id))
    }
  }

  bind() {
    if (this.generic) {
      // bind to generic array compiled into ^any
      this.path = this.containingItem.get('^any').path;
      this.guards = this.path.ids.map(() => undefined);
      this.context = this.path.length;
    } else {
      // bind reference from selection
      super.bind(this.containingItem);
      // disallow nested selections
      this.path.ids.slice(
        this.path.lub(this.containingPath).ids.length
      ).forEach(id => {
        if (typeof id === 'number') {
          throw new CompileError(this.containingItem, 'selection in nested table not yet supported')
        }
      })
    }
  }

  /** synthetic fields created on demand. Not copied */
  fields: Field[] = [];

  /** access synthetic fields */
  getMaybe(id: ID): Item | undefined {

    if (id === 0) {
      // access backing array template inside synthetic backing field
      // so selceting loop can infer the selection
      return this.get(FieldID.predefined.backing).get(0);
    }

    if (typeof id === 'number') {
      return undefined;
    }
    if (typeof id === 'string') {
      // convert string to predefined FieldID
      id = FieldID.predefined[id];
      if (!id) {
        return undefined
      }
    }
    let existing = this.fields.find(field => field.id === id);
    if (existing) {
      return existing;
    }

    // synthesize field
    const field = new Field;
    field.id = id;
    field.container = this as unknown as Container<Field>;
    field.io = 'interface'; // make field updatable
    field.formulaType = 'none';
    const backing = this.backing;

    switch (id) {

      // selected backing items
      case FieldID.predefined.selections: {
        let selected = new _Array;
        field.setValue(selected);
        selected.tracked = true;
        selected.serial = backing.serial;
        selected.sorted = backing.sorted;
        selected.createTemplate().setFrom(backing.template);
        this.selected.forEach(selectedID => {
          let item = backing.get(selectedID) as Entry;
          let selectedItem = item.copy(
            backing.containingPath, field.path);
          selected.add(selectedItem);
        })
        break;
      }

      // backing array
      case FieldID.predefined.backing: {
        field.copyValue(backing.containingItem);
        break;
      }

      // single selected backing item
      case FieldID.predefined.at: {
        field.conditional = true;
        if (this.analyzing) {
          // in analysis, conditional copy of template
          field.rejected = true;
          field.setFrom(backing.template);
          break;
        }
        if (this.selected.length !== 1) {
          // not one selection
          field.rejected = true;
          field.evaluated = true;
          break;
        }
        // TODO export index
        field.setFrom(backing.get(this.selected[0]))
        break;
      }

      default:
        return undefined;
    }
    this.fields.push(field);
    return field;
  }

  // previously was initializing selections
  // uneval() {
  //   super.uneval();
  //   this.selected = [];
  //   this.fields = [];
  // }

  copy(srcPath: Path, dstPath: Path): this {
    let to = super.copy(srcPath, dstPath);
    to.selected = this.selected.slice();
    to.generic = this.generic;
    return to;
  }

  // type compatibility requires same backing array unless generic
  updatableFrom(from: Value, fromPath?: Path, thisPath?: Path): boolean {
    if (!(from instanceof Selection)) return false;
    if (this.generic) {
      // generic selection requires type-compatible arrays
      return this.backing.updatableFrom(from.backing, fromPath, thisPath);
    }
    if (this instanceof Link !== from instanceof Link) {
      // TODO: implicitly convert a link into a selection
      return false;
    }
    return super.updatableFrom(from, fromPath, thisPath);
  }

  // equality requires backing arrays are the same
  equals(other: Selection) {
    return this.backing === other.backing && arrayEquals(this.selected, other.selected);
  }

  dump(): any {
    return this.indexes;
  }
}

/** bidirectional selections between table fields */
export class Link extends Selection {

  /** whether primary link of pair. The primary comes first in the tree. The
   * primary stores the selection state, and the secondary derives it */
  primary!: boolean;

  /** Field name of opposite link in backing array */
  // TODO: allow a path
  oppositeFieldName!: Token;

  /** FieldID of opposite link in backing array */
  oppositeFieldID!: FieldID;

  /** whether at the defining location of the link (and hence updatable) or a
   * copy. Copies can have arbitrary selections set by select?/deselect?
   * functions */
  get atHome() {
    // test without evaluating the opposite link
    const oppositeLink =
      cast(this.backing.template.get(this.oppositeFieldID).value, Link);
    return oppositeLink.path.equals(this.containingPath.up(2));
  }

  // eval Link
  protected postEval() {
    if (this.analyzing && this.containingItem.io === 'input') {
      // Link must be a tracked table field
      let template = this.containingItem.container;
      let thisArray = template.containingItem.container;
      if (
        !(template instanceof Record)
        || template.containingItem.id !== 0
        || !(thisArray instanceof _Array)
        || !thisArray.tracked
      ) {
        throw new CompileError(this.containingItem,
          'link must be a field of a tracked table')
      }
      let thisFieldID = cast(this.containingItem.id, FieldID);

      let oppositeArray = this.target!.value!;
      if (
        !(oppositeArray instanceof _Array)
        || !oppositeArray.tracked
        || !(oppositeArray.template.value instanceof Record)
      ) {
        throw new CompileError(this.containingItem,
          'link requires a tracked table')
      }
      let oppositeField =
        oppositeArray.template.getMaybe(this.oppositeFieldName.text);
      if (!oppositeField) {
        throw new CompileError(this.oppositeFieldName,
          'Opposite link not defined')
      }
      this.oppositeFieldID = oppositeField.id as FieldID;
      oppositeField.eval();
      let oppositeLink = oppositeField.value;
      if (
        !(oppositeLink instanceof Link)
        || oppositeLink.backing !== thisArray
        || oppositeLink.oppositeFieldID !== thisFieldID
      ) {
        throw new CompileError(this.oppositeFieldName,
          'Opposite link does not match')
      }
      // first link in tree is primary
      this.primary = this.containingItem.comesBefore(oppositeField)
      return;
    }

    if (!this.atHome) {
      // temp copies of link can have arbitrary selections
      return;
    }

    let array = this.backing;
    if (this.primary) {
      // auto-delete missing selections in an input field
      if (this.containingItem.io === 'input') {
        this.selected = this.selected.filter(id => array.getMaybe(id));
      }
      return;
    }

    // secondary link derives selection by querying primary links
    this.selected = [];
    const thisID = this.containingItem.container.containingItem.id as number;
    if (thisID === 0) {
      // selections in template are empty
      return;
    }
    array.items.forEach(item => {
      let oppositeLink = cast(item.get(this.oppositeFieldID).value, Link);
      oppositeLink.eval();
      if (oppositeLink.selected.includes(thisID)) {
        // opposite link selects us
        this.selected.push(item.id);
      }
    })
  }

  // TODO: allow implicit conversion from a compatible Selection
  updatableFrom(from: Value, fromPath?: Path, thisPath?: Path): boolean {
    return (
      from instanceof Link
      && this.oppositeFieldID === from.oppositeFieldID
      && super.updatableFrom(from, fromPath, thisPath)
    );
  }

  copy(srcPath: Path, dstPath: Path): this {
    let to = super.copy(srcPath, dstPath);
    to.primary = this.primary;
    to.oppositeFieldName = this.oppositeFieldName;
    to.oppositeFieldID = this.oppositeFieldID;
    return to;
  }


}


export const arrayBuiltinDefinitions = `
& = do{in: array{anything}; value: in[]; builtin &; export index = 0}
length = do{in: array{anything}; builtin length}
delete? = do{in: array{anything}; index: 0; builtin delete?}
&& = do{in: array{anything}; from: in; builtin &&}
at? = do{in: array{anything}; index: 0; builtin at?}
at-or-template = do{in: array{anything}; index: 0; builtin at-or-template}
update? = do{in: array{anything}; index: 0; value: in at-or-template index; builtin update?}
skip-white = do{in: ''; builtin skip-white}
select? = do{in: selection{any array{anything}}; index: 0; builtin select?}
deselect? = do{in: selection{any array{anything}}; index: 0; builtin deselect?}
`

/** & array add */
builtins['&'] = (s: Statement, array: _Array, value: builtinValue) => {
  let copy = array.copy(array.containingPath, s.path);
  s.setValue(copy);
  if (s.analyzing) {
    // during analysis just increment serial # to break copying detection
    ++copy.serial;
    s.exportFrom(0);
    return;
  }

  let entry = new Entry;
  // add to end
  copy.add(entry);
  entry.io = 'input';
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
builtins['&&'] = (s: Statement, a: _Array, b: _Array) => {
  let copy = a.copy(a.containingPath, s.path);
  s.setValue(copy);
  if (s.analyzing) {
    // during analysis just increment serial # to break copying detection
    ++copy.serial;
    return;
  }

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
  let copy = array.copy(array.containingPath, s.path);
  s.setValue(copy);
  if (s.analyzing) {
    // during analysis just increment serial # to break copying detection
    ++copy.serial;
    return;
  }

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
  let copy = array.copy(array.containingPath, s.path);
  s.setValue(copy);
  if (s.analyzing) {
    // force change during analysis
    s.uncopy();
  }
  if (accepted) {
    let item = copy.items[index - 1];
    item.detachValue();
    item.setFrom(value);
  }
}

builtins['skip-white'] = (s: Statement, a: _Array) => {
  s.setFrom(a.asString().trimStart());
}

/** selections */
builtins['select?'] = (s: Statement, sel: Selection, index: number) => {
  let item = sel.backing.items[index - 1];
  s.setAccepted(!!item);
  // modify selection
  let result = sel.copy(sel.containingPath, s.path);
  s.setFrom(result);
  result.eval();
  if (item) {
    result.select(item.id);
  }
}

builtins['deselect?'] = (s: Statement, sel: Selection, index: number) => {
  let item = sel.backing.items[index - 1];
  s.setAccepted(!!item);
  // modify selection
  let result = sel.copy(sel.containingPath, s.path);
  s.setFrom(result);
  result.eval();
  if (item) {
    result.deselect(item.id);
  }
}

