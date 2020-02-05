import { Head, History, Item, Path, Parser, Version, VersionID, FieldID, Token, trap  } from "./exports";

/** A subtext workspace */
export class Space extends Item<never, History> {

  /** Space is at the top of the tree */
  declare container: never;
  _path = Path.empty;
  _space = this;

  /** whether analyzing space - effects evaluation logic */
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


  /** dump item at string path in current version */
  dumpAt(path: string): Item {
    return this.value!.currentVersion.down(path).dump();
  }

  /** compile a doc
   * @param source
   * @param builtin flag for compiling builtins
   * @throws SyntaxError
   */
  static compile(source: string, builtin = false): Space {
    let space = new Space;
    let history = new History;
    space.value = history;
    history.holder = space;
    // FIXME: make real history
    let version = new Version;
    version.id = space.newVersionID('initial');
    history.add(version);
    version.container = history;
    let head = new Head;
    version.value = head;
    head.holder = version;
    // compile
    let parser = new Parser(source);
    parser.requireHead(head);

    // analyze all formulas by evaluating doc
    space.analyzing = true;
    space.eval();
    space.analyzing = false;
    // TODO: reset doc state after analysis

    return space;
  }
}

