import { Block, FieldID, Head, Field, arrayLast, assertDefined, Item } from "./exports";

/** History is the top value of a Space. The History is a Block whose fields
 * have a VersionID and contain a Head */
export class History extends Block<Version> {

  get versions() {
    return this.items;
  }

  get currentVersion(): Version {
    return arrayLast(this.versions);
  }

  // dump current version
  dump() { return this.currentVersion.dump()}
}

/** Version is a Field with a VersionID and containing a Head */
export class Version extends Field<VersionID, Head> {
  // versions are all outputs
  isInput = false;

  // No previous value of Head
  previous(): Item | undefined {
    return undefined;
  }
}

/** space-unique ID of a Version */
export class VersionID extends FieldID {
}

