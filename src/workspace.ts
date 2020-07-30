import { Head, History, Item, Path, Parser, Version, VersionID, FieldID, Token, trap, builtinDefinitions, Code, Statement, StaticError, Try, Call, Do, With, assert, Value, Reference, Choice, assertDefined, OptionReference, Container  } from "./exports";

/** A subtext workspace */
export class Workspace extends Item<never, History> {

  /** Workspace is at the top of the tree */
  declare container: never;
  _path = Path.empty;
  _workspace = this;

  /** whether eval() should do analysis */
  analyzing: boolean = false;

  /** serial numbers assigned to FieldIDs */
  private fieldSerial = 0;

  newFieldID(name?: string, token?: Token): FieldID {
    let serial = ++this.fieldSerial
    let id = new FieldID(serial);
    id.name = name;
    id.token = token;
    return id;
  }

  /** serial numbers assigned to Versions */
  private versionSerial = 0;

  private newVersionID(name: string): FieldID {
    let serial = ++this.versionSerial
    let id = new VersionID(serial);
    id.name = name;
    return id;
  }

  /** current version of workspace */
  get currentVersion() {
    return this.value!.currentVersion;
  }


  /** queue of items with deferred analysis */
  analysisQueue: Item[] = [];
  /** queue of functions to analyze exports */
  exportAnalysisQueue: (()=>void)[] = [];

  /** compile a doc
   * @param source
   * @param builtin whether to include builtins first
   * @throws SyntaxError
   */
  static compile(source: string, builtins = true): Workspace {
    if (builtins) {
      source = "builtins = include builtins\n" + source;
    }
    let ws = new Workspace;
    let history = new History;
    ws.value = history;
    history.containingItem = ws;
    let version = new Version;
    version.id = ws.newVersionID('initial');
    history.add(version);
    let head = new Head;
    version.value = head;
    head.containingItem = version;
    // compile
    let parser = new Parser(source);
    parser.requireHead(head);

    // analyze all formulas by evaluating doc
    ws.analyzing = true;
    ws.eval();

    // execute deffered analysis
    while (ws.analysisQueue.length) {
      ws.analysisQueue.shift()!.resolve();
    }
    while (ws.exportAnalysisQueue.length) {
      ws.exportAnalysisQueue.shift()!();
    }

    // analyze exposed updatable outputs
    const analyzeUpdates = (container: Container<Item>) => {
      for (let item of container.items) {
        // (seems unneeded now) Skip unevaluated items to avoid recursive choice
        // if (!item.value || item.deferral) continue;
        if (item.isUpdatableOutput) {
          // analyze updatable output
          version.propagateUpdates(item.setDelta(item));
        } else if (item.isInput && item.value instanceof Container) {
          // drill into input containers
          analyzeUpdates(item.value);
        }
      }
    }
    analyzeUpdates(head);

    // initialize to force recalc after analysis
    ws.initialize();

    // Item.resolve() calls might have triggered evaluations, so re-initialize
    // this was happening on a try inside a on-update, but now those are being
    // forced to resolve
    //ws.initialize();


    ws.analyzing = false;

    // check for unused code statements and validate do/with blocks
    for (let item of ws.visit()) {
      if (
        item instanceof Statement &&
        !item.used
        && (item.dataflow === undefined || item.dataflow === 'let')
        && !(item.container instanceof Try)
        && !(item.container instanceof Call)
      ) {
        throw new StaticError(item, 'unused value')
      }
      if (item.value instanceof Do && item.usesPrevious) {
        throw new StaticError(item, 'do-block cannot use previous value')
      }
      if (item.value instanceof With && !item.usesPrevious) {
        throw new StaticError(item, 'with-block must use previous value')
      }
    }
    ws.eval();

    return ws;
  }

  /** dump item at string path in current version */
  dumpAt(path: string): Item {
    return this.currentVersion.down(path).dump();
  }

  /** update a value at a path in current version, creating a new version.
   *
   * If the path refers to a Choice, the value must be the FieldID or string
   * name of an option. If the path refers to a non-Choice, the value can be a
   * Value or number or string
   */
  updateAt(path: string, value: number | boolean | string | Value | FieldID) {
    let target = this.currentVersion.down(path);
    if (!this.currentVersion.isWritable(target)) {
      throw 'cannot update';
    }

    let choose = target.value instanceof Choice;

    // append new version to history
    let history = this.value!;
    let newVersion = new Version;
    // using time as label
    newVersion.id = this.newVersionID(new Date().toLocaleString());
    history.add(newVersion);
    // new version formula is a update ro choose command
    newVersion.formulaType = choose ? 'choose' : 'update';

    // target is dependent reference to target in previous version
    let targetRef = choose ? new OptionReference : new Reference;
    newVersion.setMeta('^target', targetRef);
    targetRef.path = target.path;
    // flag as dependent ref
    targetRef.tokens = [new Token('that', 0, 0, '')];
    // context of the reference is the previous version
    targetRef.context = 1;
    // Assert all conditionals along path
    targetRef.guards = [];
    for (
      let up = target;
      !!up.container;
      up = up.container.containingItem
    ) {
      targetRef.guards.unshift(up.conditional ? '!' : undefined);
    }

    if (choose) {
      // set option ID into target OptionalReference
      assert(value instanceof FieldID || typeof value === 'string');
      // validate option FieldID
      let optionID = target.get(value).id as FieldID;
      assert(targetRef instanceof OptionReference);
      targetRef.optionID = optionID;
      targetRef.optionToken = new Token(
        'name', 0, optionID.name!.length - 1, optionID.name!
      );
      // leave payload undefined
    } else {
      // payload is value to write
      let payload = newVersion.setMeta('^payload');
      assert(!(value instanceof FieldID));
      payload.setFrom(value);
    }
    // evaluate new version
    newVersion.eval();
  }
}

