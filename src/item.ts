import {ID, Path, Container} from "./exports";
/**
 * Superclass of items, the fundamental unit of information in Subtext.
 *
 * Items form a tree. A document has a History item at the top, which contains
 * versions of Head items, which contain the visible state of the document. At
 * the bottom of the tree are Atom items. Items are composed into Block and List
 * items.
 */

export abstract class Item {



  /** ID of the item within its container */
  id!: ID;

  /** containing item */
  up?: Container;

  /** memoized Path */
  private _path?: Path;
  get path(): Path {
    if (!this._path) {
      this._path = new Path([...this.up!.path.ids, this.id]);
    }
    return this._path
  }



}
