import { History, Item, Path } from "./exports";

/** A subtext document */
export class Document extends Item<never, History> {

  /** Document is at the top of the tree */
  declare up: never;
  get path() {
    return Path.empty;
  }

  /** value is History */
  value = new History();

}

