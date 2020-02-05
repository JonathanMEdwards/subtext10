import { Head, History, Item, Path, Parser, Version, VersionID, FieldID, Token, trap  } from "./exports";

/** A subtext doc */
export class Doc extends Item<never, History> {

  /** Doc is at the top of the tree */
  declare container: never;
  _path = Path.empty;
  _doc = this;

  /** whether analyzing doc - effects evaluation logic */
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


  /** compile a doc
   * @param source
   * @param builtin flag for compiling builtins
   * @throws SyntaxError
   */
  static compile(source: string, builtin = false): Doc {
    let doc = new Doc;
    let history = new History;
    doc.value = history;
    history.container = doc;
    // FIXME: make real history
    let version = new Version;
    version.id = doc.newVersionID('compiled version');
    history.currentVersion = version;
    version.container = history;
    let head = new Head;
    version.value = head;
    head.container = version;
    // compile
    let parser = new Parser(source);
    parser.requireHead(head);

    // analyze all formulas by evaluating doc
    doc.analyzing = true;
    version.eval();
    doc.analyzing = false;
    // TODO: reset doc state after analysis

    return doc;
  }
}

