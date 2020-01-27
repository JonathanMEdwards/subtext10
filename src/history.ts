import { Block, FieldID, Head, Item } from "./exports";

/** History is the top value of a document. The History is a Block whose fields
 * have a VersionID and contains a Head */
export class History extends Block<Version> {

  get versions() {
    return this.items;
  }
}

/** Version is a Field with a VersionID and containing a Head */
export class Version extends Item<VersionID, Head> {

}

/** Document-unique ID of a History item */
export class VersionID extends FieldID {

}

