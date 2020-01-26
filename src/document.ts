import { ID } from "./exports";

/** A subtext document */
export class Document {

  /** History is root of item tree */
  history: History = new History();

}

/** globally unique ID of a document. Stored in History.id */
export class DocumentID extends ID {

}
