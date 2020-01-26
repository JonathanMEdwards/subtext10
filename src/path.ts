/** Absolute path within the document. A sequence of IDs starting with the
 * VersionID in the Head. Immutable after construction */
export class Path {

  readonly ids: ReadonlyArray<ID>;

  constructor(ids: ID[]) {
    this.ids = ids;
  }

  static readonly empty = new Path([]);
}

/** superclass of ID of an item within its container, stored in Item.id.
 * Immutable.  */
export abstract class ID {

}
