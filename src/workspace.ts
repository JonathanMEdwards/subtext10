import { Head, History, Item, Path, Parser, Version, VersionID, FieldID, Token, Statement, CompileError, Try, Call, Do, With, Reference, assertDefined, Container, _Array, isNumber  } from "./exports";

/** A subtext workspace */
export class Workspace extends Item<never, History> {

  /** Workspace is at the top of the tree */
  declare container: never;
  _path = Path.empty;

  /** whether eval() should do analysis */
  private _analyzing: boolean = false;
  get analyzing() { return this._analyzing; }

  /** serial numbers assigned to FieldIDs */
  private fieldSerial = 0;

  newFieldID(name?: string, token?: Token): FieldID {
    let serial = ++this.fieldSerial
    let id = new FieldID(serial);
    id.name = name;
    id.token = token;
    return id;
  }

  // FIXME: FieldIDs maybe allocated within versionIDs
  private newVersionID(name: string): FieldID {
    let serial = ++this.fieldSerial
    let id = new VersionID(serial);
    id.name = name;
    return id;
  }

  /** add a new version to history */
  private newVersion(): Version {
    let history = this.value!;
    let newVersion = new Version;
    // using time as label
    newVersion.id = this.newVersionID(new Date().toLocaleString());
    newVersion.io = 'data';
    newVersion.formulaType = 'none';
    history.add(newVersion);
    return newVersion;
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

    // analyze
    ws.analyze(version);

    version.evaluated = true;
    return ws;
  }

  /** analyze a version. Sets Item.editError for errors that can occur during
   * editing. Throws exceptions on errors that only occur in compiling. */
  analyze(version: Version) {
    const head = assertDefined(version.value);

    // set global analyzing flag and evaluate to do analysis
    // assumes currently unevaluated
    this._analyzing = true;
    head.eval();

    // execute deffered analysis
    while (this.analysisQueue.length) {
      this.analysisQueue.shift()!.resolve();
    }
    while (this.exportAnalysisQueue.length) {
      this.exportAnalysisQueue.shift()!();
    }

    // analyze updates of visible interfaces
    const analyzeUpdates = (container: Container<Item>) => {
      for (let item of container.items) {
        // (seems unneeded now) Skip unevaluated items to avoid recursive choice
        // if (!item.value || item.deferral) continue;
        if (item.io === 'interface') {
          // analyze interface update
          let delta = item.setDelta(item);
          // uncopy value so treated as different
          delta.uncopy();
          version.feedback(version, item);
        } else if (item.io === 'input' && item.value instanceof Container) {
          // drill into input containers
          analyzeUpdates(item.value);
        }
      }
    };
    analyzeUpdates(head);

    // unevaluate to discard analysis computations
    head.uneval();

    // Item.resolve() calls might have triggered evaluation.
    // Signature is throwing 'unused value: index: 0'
    // this was happening on a try inside a on-update, but now those are being
    // forced to resolve

    // clear analyzing flag
    this._analyzing = false;

    // check for unused code statements and validate do/with blocks
    for (let item of version.visit()) {
      // ignore array entries (possible after edits)
      // FIXME: not sure why array entries trigger unusued value error
      if (item.path.ids.slice(version.path.length).find(
        id => isNumber(id) && id !== 0)
      ) {
        continue;
      }

      if (item instanceof Statement &&
        !item.used
        && (item.dataflow === undefined || item.dataflow === 'let')
        && !(item.container instanceof Try)
        && !(item.container instanceof Call)
      ) {
        throw new CompileError(item, 'unused value');
      }
      if (item.value instanceof Do && item.usesPrevious) {
        throw new CompileError(item, 'do-block cannot use previous value');
      }
      if (item.value instanceof With && !item.usesPrevious) {
        throw new CompileError(item, 'with-block must use previous value');
      }
    }

    // evaluate version
    head.eval();
  }

  /** dump item at string path in current version */
  dumpAt(path: string): Item {
    return this.currentVersion.down(path).dump();
  }




  /** create a new version by updating the current one.
   *
   * Executes `path := formula`.
   * @param path dotted string allowing array indices.
   * @param formula syntax of formula.
   *   */
  updateAt(path: string, formula: string) {
    // target is dependent reference to target in previous version
    let target = this.currentVersion.down(path);
    if (!this.currentVersion.writeSink(target)) {
      throw 'not updatable';
    }
    let targetRef = new Reference;
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

    // append new version to history
    let newVersion = this.newVersion();
    // new version formula is a update or choose command
    newVersion.formulaType = 'update';
    newVersion.setMeta('^target', targetRef);

    // compile payload from formula
    let payload = newVersion.setMeta('^payload')
    let parser = new Parser(formula);
    parser.space = this;
    parser.requireFormula(payload);

    // evaluate new version
    newVersion.eval();

    // Throw edit error
    if (newVersion.editError) {
      throw 'edit error: ' + newVersion.originalEditError;
    }
  }

  /** write a JS value to a path */
  writeAt(path: string, value: number | string) {
    let formula: string;
    if (typeof value === 'string') {
      formula = "'" + value + "'";
    } else {
      formula = value.toString();
    }
    this.updateAt(path, formula);
  }

  /** set a path to `on` */
  turnOn(path: string) {
    this.updateAt(path, 'on');
  }

  /** create an item in an array */
  createAt(path: string) {
    this.updateAt(path, '&()');
  }

  /** delete an item from an array */
  deleteAt(path: string, index: number) {
    this.updateAt(path, 'delete! ' + index);
  }

  /** add a selection */
  selectAt(path: string, index: number) {
    this.updateAt(path, 'select! ' + index);
  }

  /** remove a selection */
  deselectAt(path: string, index: number) {
    this.updateAt(path, 'deselect! ' + index);
  }


  /** Execute an edit command.
   * @param path string path without leading .
   * @param command edit command starting with ::
   */
  editAt(path: string, command: string) {
    // target is dependent reference to target in previous version
    let target = this.currentVersion.down(path);
    let targetRef = new Reference;
    targetRef.path = target.path;
    // flag as dependent ref
    targetRef.tokens = [new Token('that', 0, 0, '')];
    // context of the reference is the previous version
    targetRef.context = 1;
    // ignore conditionals
    targetRef.guards = [];
    for (
      let up = target;
      !!up.container;
      up = up.container.containingItem
    ) {
      targetRef.guards.unshift(undefined);
    }

    // append new version to history
    let newVersion = this.newVersion();
    // new version formula is a update or choose command
    newVersion.formulaType = 'update';
    newVersion.setMeta('^target', targetRef);

    // compile command
    let parser = new Parser(command);
    parser.space = this;
    parser.requireEdit(newVersion);

    // evaluate new version
    newVersion.eval();
  }

  /** array of items in current version with edit errors */
  get editErrors(): Item[] {
    return this.currentVersion.editErrors;
  }

  /** Array of edit error messages in current version */
  get editErrorMessages(): string[] {
    return this.currentVersion.editErrorMessages;
  }
}