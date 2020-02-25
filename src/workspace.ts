import { Head, History, Item, Path, Parser, Version, VersionID, FieldID, Token, trap, BuiltinDefinitions  } from "./exports";

/** A subtext workspace */
export class Workspace extends Item<never, History> {

  /** Workspace is at the top of the tree */
  declare container: never;
  _path = Path.empty;
  _workspace = this;

  /** whether analyzing workspace - effects evaluation logic */
  analyzing = false;

  /** serial numbers assigned to FieldIDs */
  fieldSerial = 0;

  newFieldID(name?: string, token?: Token): FieldID {
    let serial = ++this.fieldSerial
    let id = new FieldID(serial);
    id.name = name;
    id.token = token;
    return id;
  }

  /** serial numbers assigned to Versions */
  versionSerial = 0;

  newVersionID(name?: string): FieldID {
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

  /** queue of deferred analysis functions */
  analysisQueue: (() => void)[] = [];

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
    // FIXME: make real history
    let version = new Version;
    version.id = ws.newVersionID('initial');
    history.add(version);
    version.container = history;
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
      (ws.analysisQueue.shift()!)();
    }

    ws.analyzing = false;
    // initialize and recalc after analysis
    ws.initialize();
    ws.eval();

    return ws;
  }

  /** builtin workspace to be included into other workspaces */
  static readonly builtins = Workspace.compile(BuiltinDefinitions, false);
}