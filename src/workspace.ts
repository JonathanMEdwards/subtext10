import { Head, History, Item, Path, Parser, Version, VersionID, FieldID, Token, trap, builtinDefinitions, Code, Statement, StaticError, Try, Call, Do, With, assert, Value, Reference  } from "./exports";

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

  /** dump item at string path in current version */
  dumpAt(path: string): Item {
    return this.currentVersion.down(path).dump();
  }

  /** write a value at a path in current version, creating a new version */
  writeAt(path: string, value: number | string | Value) {
    let target = this.currentVersion.down(path);
    // TODO: assert(target.modifiable);
    if (!target.isInput) throw 'unwritable location'

    // append new version to history
    let history = this.value!;
    let newVersion = new Version;
    // using time as label
    newVersion.id = this.newVersionID(new Date().toLocaleString());
    history.add(newVersion);
    // new version formula is a change command
    newVersion.formulaType = 'change';

    // LHS is dependent reference to target in previous version
    let lhs = new Reference;
    newVersion.setMeta('^lhs', lhs);
    lhs.path = target.path;
    // context of the reference is the previous version
    lhs.context = 1;
    // FIXME: assert conditional fields in path
    lhs.guards = new Array(target.path.length - 1);
    lhs.guards.fill(undefined);
    // flag as dependent ref
    lhs.tokens = [new Token('that', 0, 0, '')];

    // RHS is value to write
    let rhs = newVersion.setMeta('^rhs');
    rhs.setFrom(value);

    // evaluate change
    newVersion.eval();
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

    // initialize to force recalc after analysis
    ws.initialize();

    ws.analyzing = false;
    // check for unused code statements and validate do/with blocks
    for (let item of ws.visit()) {
      if (
        item instanceof Statement &&
        !item.used
        && item.dataflow !== 'check'
        && item.dataflow !== 'export'
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
}

