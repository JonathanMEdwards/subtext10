import { Workspace, ID, Path, Container, Value, RealID, Metadata, MetaID, isString, another, Field, Reference, trap, assert, PendingValue, Code, Token, cast, arrayLast, Call, Text, evalBuiltin, Try} from "./exports";
/**
 * An Item contains a Value. A Value may be a Container of other items. Values
 * that do not contain Items are Base values. This forms a tree, where Values
 * are the nodes and Items are the edges. The top Item is a Workspace. Each
 * contained item carries an ID, and we identify items by the path of IDs down
 * from the top.
 */

export abstract class Item<I extends RealID = RealID, V extends Value = Value> {

  /** Physical container */
  container!: Container<this>;

  /** memoized Workspace */
  _workspace?: Workspace;
  get workspace(): Workspace {
    if (!this._workspace) {
      this._workspace = this.container.workspace;
    }
    return this._workspace;
  }

  /** ID of the item within its container */
  id!: I;

  /** memoized Path */
  _path?: Path;
  get path(): Path {
    if (!this._path) {
      this._path = this.container.containingItem.path.down(this.id);
    }
    return this._path
  }
  // FIXME: report ordinals on anon fields, not serials
  get pathString() { return this.path.toString(); }

  /** Logical container: metadata is physically contained in base item, but
   * logically is a peer */
  get up(): Item | undefined {
    return this.container!.up;
  }

  /** iterate upwards through logical containers to Workspace */
  *upwards(): Generator<Item> {
    for (
      let item: Item = this;
      !(item instanceof Workspace);
      item = item.container.containingItem
    ) {
      yield item;
    }
  }

  /** iterate upwards starting with this */
  *thisUpwards(): Generator<Item> {
    yield this;
    yield* this.upwards();
  }

  /** top-down iteration through all items */
  *visit(): IterableIterator<Item> {
    if (this.metadata) {
      yield* this.metadata.visit();
    }
    yield this;
    if (this.value instanceof Container) {
      yield* this.value.visit()
    }
  }

  /** Metadata block. Undefined if no metadata */
  metadata?: Metadata;

  /** the Item at a downward path else trap. Accepts a dotted string or ID[] */
  down(path: Path | ID[] | string): Item {
    if (path === '') return this;
    let ids = (
      path instanceof Path
        ? path.ids
        : typeof path === 'string'
          ? path.split('.')
          : path
    )
    let target: Item = this;
    ids.forEach(id => {
      target = target.get(id);
    });
    return target;
  }

  /** the contained item with an ID else trap */
  get(id: ID): Item {
    return this.getMaybe(id) ?? trap(this.path + ': ' + id + ' undefined');
  }

  /** the contained item with an ID else undefined */
  getMaybe(id: ID): Item | undefined {
    if (
      id instanceof MetaID
      || (isString(id) && id.startsWith('^'))
    ) {
      // metadata access
      return this.metadata?.getMaybe(id);
    }

    // evaluate and get from value
    return this.value?.getMaybe(id);
  }

  /** set a metadata field by name. Must not already exist. Value can be
   * undefined */
  setMeta(name: string, value?: Value): Field {
    if (!this.metadata) {
      // allocate metadata block
      this.metadata = new Metadata;
      this.metadata.containingItem = this;
    }
    return this.metadata.set(name, value);
  }

  /**
   * How value is computed. The formula is stored in various metadata
   * fields depending on this tag.
   *
   * none: value is a constant in item.value. Used for literal outputs.
   *
   * literal: value is in ^literal
   *
   * reference: value is target of a Reference in ^reference
   *
   * code: value is result of a Code block in ^code
   *
   * change: dependent reference in ^lhs, formula in ^rhs
   *
   * call: Call block in ^call, starting with reference to program followed by
   * changes on the arguments
   *
   * include: currently includes only builtins
   *
   * builtin: ^builtin contains name of builtin as a Text value
   *
   *  */
  formulaType: (
    'none' | 'literal' | 'reference' | 'code' | 'change' | 'call' | 'include'
    | 'builtin'
  ) = 'none';

  /** whether input or output item */
  isInput = false;

  /** whether value should be rederived on copies */
  get isDerived() {
    return !this.isInput && this.formulaType !== 'none'
  }

  /** whether item can reject having a value. Determined during analysis */
  conditional = false;
  setConditional(b: boolean) {
    if (!b) return;
    if (this.workspace.analyzing) {
      this.conditional = true;
    } else {
      assert(this.conditional);
    }
  }

  /** Evaluation rejected. Not copied */
  rejected = false;

  /** value of item. Undefined when not yet derived from formula or rejected.
   * Copied on non-derived items  */
  value?: V;

  /** flag that already evaluated, avoiding redundant eval scans. Not strictly
   * necessary, but helps me not worry about evaling whenever in doubt. Not
   * copied */
  evalComplete?: boolean;

  /** max depth of items */
  static readonly DepthLimit = 100;

  /** Evaluate metadata and value */
  eval() {
    if (this.value) {
      if (this.evalComplete) return;
      assert(!this.isDerived);
      // evaluate metadata then contents
      this.metadata?.eval();
    } else if (this.rejected) {
      assert(this.evalComplete);
      return;
    } else {

      // derive value
      assert(!this.evalComplete);

      // set PendingValue to catch evaluation cycles
      this.setValue(new PendingValue);

      if (this.path.length > Item.DepthLimit) {
        throw new Crash(this.container.token!, 'Workspace too deep')
      }

      // evaluate metadata
      this.metadata?.eval();

      // evaluate formula
      switch (this.formulaType) {
        case 'literal':
          this.replaceValue(this.get('^literal'));
          break;

        case 'reference':
          let ref = cast(this.get('^reference').value, Reference);
          this.setConditional(ref.conditional);
          this.rejected = ref.rejected;
          this.replaceValue(ref.target);
          break;

        case 'code':
          let code = cast(this.get('^code').value, Code);
          this.setConditional(code.conditional);
          this.rejected = code.rejected;
          this.replaceValue(code.result);
          break;

        case 'change':
          this.change();
          break;

        case 'call':
          let call = cast(this.get('^call').value, Call);
          this.setConditional(call.conditional);
          this.rejected = call.rejected;
          this.replaceValue(call.result);
          break;

        case 'include':
          this.replaceValue(Workspace.builtins.currentVersion);
          break;

        case 'builtin':
          let name = cast(this.get('^builtin').value, Text).value;
          evalBuiltin(this, name);
          break;

        default:
          trap();
      }
    }

    // evaluate value contents
    if (this.value) this.value.eval();

    this.evalComplete = true;
  }

  /** evaluate change operation */
  private change() {
    // lhs and rhs in metadata already evaluated
    let ref = cast(this.get('^lhs').value, Reference);
    assert(ref.dependent);
    assert(ref.path.length > ref.context);
    // get previous value, which is context of reference
    this.setConditional(ref.conditional);
    if (ref.rejected) {
      // LHS reference rejected
      this.rejected = true;
      if (!this.workspace.analyzing) return;
    }
    assert(ref.target);
    let prev = this.workspace.down(ref.path.ids.slice(0, ref.context));
    // prev.eval(); // suppressed for arg assignment analysis
    // copy previous value
    this.replaceValue(prev);
    // follow LHS dependent path within previous value
    let target = this.down(ref.path.ids.slice(ref.context));
    if (!target.isInput) {
      throw new StaticError(arrayLast(ref.tokens), 'changing an output')
    }
    // replace target value with value of RHS
    target.eval();
    let source = this.get('^rhs');
    if (!target.value!.sameType(source.value!, source.path, target.path)) {
      throw new StaticError(ref.tokens[0], 'changing type of value')
    }
    this.setConditional(source.conditional);
    if (source.rejected) this.rejected = true;
    if (source.value) target.replaceValue(source);
  }

  /** The previous item in evaluation order. Used by dependent references. */
  previous(): Item | undefined {
    // should only be used during analysis to bind references
    assert(this.workspace.analyzing);
    let container = this.container;
    let itemIndex = container.items.indexOf(this);
    assert(itemIndex >= 0);
    if (
      !itemIndex
      || container instanceof Metadata
      || container instanceof Try
    ) {
      // At beginning of container, or in metadata/try
      // Use previous in grand-container. Scan stops in Version
      return container.containingItem.previous();
    }
    // previous item in container
    // TODO: skip over locals
    return container.items[itemIndex - 1];
  }

  /** reset to initially defined state */
  reset() {
    if (this.metadata) this.metadata.reset();
    this.evalComplete = false;
    assert(this.formulaType);
    if (this.formulaType !== 'none') {
      // recalc value
      this.rejected = false;
      if (this.value) this.prune();
      return;
    }
    // recurse on predefined values
    assert(!this.rejected);
    this.value!.reset();
  }

  /** prune value, so it can be set */
  prune() {
    assert(this.value?.containingItem === this);
    this.value.containingItem = undefined as any;
    this.value = undefined;
  }

  /** set value */
  setValue(value: Value) {
    assert(!this.value);
    assert(!value.containingItem);
    this.value = value as V;
    value.containingItem = this;
  }

  /** replace current value from another item, translating internal path. Just
   * prunes current value if item or its value are undefined */
  replaceValue(src?: Item) {
    this.prune();
    if (src && src.value) {
      this.setValue(src.value.copy(src.path, this.path));
    }
  }

  /** source of value through copying */
  // FIXME prob should be a Path, translated through copies
  source?: this;

  /** make copy, bottom up, translating paths contextually */
  copy(srcPath: Path, dstPath: Path): this {
    let to = another(this);
    to.id = this.id;
    to.formulaType = this.formulaType;
    to.isInput = this.isInput;
    to.conditional = this.conditional;

    // record copy
    to.source = this;

    if (this.workspace.analyzing) {
      // copy rejection during analysis, which indicates conditionality
      // to.rejected = this.rejected;
    }

    // copy metadata
    if (this.metadata) {
      to.metadata = this.metadata.copy(srcPath, dstPath);
      to.metadata.containingItem = to;
    }

    // copy underived values
    if (this.value && !this.isDerived) {
      assert(this.value.containingItem === this);
      to.value = this.value.copy(srcPath, dstPath);
      to.value.containingItem = to;
    }

    return to;
  }

  /** compare types within a path context */
  sameType(from: Item, srcPath: Path, dstPath: Path): boolean {
    return (
      this.id === from.id
      && this.isInput === from.isInput
      && this.formulaType === from.formulaType
      && (
        this.formulaType !== 'none'
        || this.value!.sameType(from.value!, srcPath, dstPath)
      )
      && !!this.metadata === !!from.metadata
      && (
        !this.metadata
        || this.metadata.sameType(from.metadata!, srcPath, dstPath)
      )
    )
  }

  // dump value
  dump() { return this.value ? this.value.dump() : {'': 'undefined'}}
}

/** FIXME: reify into state so unaffected items can operate */
export class StaticError extends Error {
  constructor(token: Token, description: string) {
    super(description + ': ' + token.source.slice(token.start, token.end + 10));
  }
}

/** dynamic crash error */
export class Crash extends Error {
  constructor(token?: Token, description = 'crash') {
    super(
      description + ': '
      + token?.source?.slice(token.start, token.end + 10)
    );
  }
}