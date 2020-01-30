import { Head, History, Item, Path, Parser, Version, VersionID, FieldID, Token  } from "./exports";

/** A subtext doc */
export class Doc extends Item<never, History> {

  /** Doc is at the top of the tree */
  declare up: never;
  get path() {
    return Path.empty;
  }
  get doc(): Doc { return this; }

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
    history.up = doc;
    // FIXME: make real history
    let version = new Version;
    version.id = doc.newVersionID('compiled version');
    history.currentVersion = version;
    version.up = history;
    let head = new Head;
    version.value = head;
    head.up = version;
    // compile
    let parser = new Parser(source);
    parser.requireHead(head);

    return doc;
  }
}

