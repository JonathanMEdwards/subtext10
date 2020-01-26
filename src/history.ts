import { Block, Path, BlockID, DocumentID } from "./exports";

/** History is the top item of a document. It computes versions of the document Head */
export class History extends Block {

  /** Globally unique ID of this document. Not included in paths within the
   * document */
  id!: DocumentID;

  /** History is top of document. Path is empty */
  get path() {
    return Path.empty;
  }


}

/** Document-unique ID of a History item */
export class VersionID extends BlockID {

}
