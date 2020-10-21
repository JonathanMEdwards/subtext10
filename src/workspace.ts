import { Head, History, Item, Path, Parser, Version, VersionID, FieldID, Token, trap, builtinDefinitions, Code, Statement, StaticError, Try, Call, Do, With, assert, Value, Reference, Choice, assertDefined, OptionReference, Container, Field, _Array, Entry  } from "./exports";

/** A subtext workspace */
export class Workspace extends Item<never, History> {

  /** Workspace is at the top of the tree */
  declare container: never;
  _path = Path.empty;
  _workspace = this;

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
    ws._analyzing = true;
    ws.eval();

    // execute deffered analysis
    while (ws.analysisQueue.length) {
      ws.analysisQueue.shift()!.resolve();
    }
    while (ws.exportAnalysisQueue.length) {
      ws.exportAnalysisQueue.shift()!();
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
          version.feedback(item);
        } else if (item.io === 'input' && item.value instanceof Container) {
          // drill into input containers
          analyzeUpdates(item.value);
        }
      }
    }
    analyzeUpdates(head);

    // initialize to force recalc after analysis
    ws.initialize();

    // Item.resolve() calls might have triggered evaluation.
    // Signature is throwing 'unused value: index: 0'
    // this was happening on a try inside a on-update, but now those are being
    // forced to resolve


    ws._analyzing = false;

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




  /** create a new version by updating the current one.
   *
   * Executes `path := formula`.
   * @param path dotted string allowing array indices.
   * @param formula syntax of formula.
   *   */
  updateAt(path: string, formula: string) {
    let target = this.currentVersion.down(path);
    if (!this.currentVersion.writeSink(target)) {
      throw 'not updatable';
    }

    // append new version to history
    let history = this.value!;
    let newVersion = new Version;
    // using time as label
    newVersion.id = this.newVersionID(new Date().toLocaleString());
    history.add(newVersion);
    // new version formula is a update ro choose command
    newVersion.formulaType = 'update';

    // target is dependent reference to target in previous version
    let targetRef = new Reference;
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

    // compile payload from formula
    let payload = newVersion.setMeta('^payload')
    let parser = new Parser(formula);
    parser.space = this;
    parser.requireFormula(payload);

    // evaluate new version
    newVersion.eval();
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
}