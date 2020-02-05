import { Block, FieldID, Head, Item, Field } from "./exports";

/** History is the top value of a Space. The History is a Block whose fields
 * have a VersionID and contains a Head */
export class History extends Block<Version> {

  get versions() {
    return this.items;
  }

  /** Current state of Space */
  // FIXME: hack till history actually implemented
  currentVersion!: Version;

  dump() { return this.currentVersion.dump()}
}

/** Version is a Field with a VersionID and containing a Head */
export class Version extends Field<VersionID, Head> {
  // versions are all outputs
  isInput = false;
}

/** space-unique ID of a Version */
export class VersionID extends FieldID {
}

