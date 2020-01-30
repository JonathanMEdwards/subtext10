import { MetaID, VersionID, assert, FieldID, Base, another } from "./exports";

/**
 * ID of an item. Immutable and interned, so can use ===
 * Series use plain JS numbers, either ordinals or serial numbers.
 * Strings are used as a convenience in APIs but not used as Item id
 */
export type RealID = FieldID | number;
export type ID = RealID | string;

/** Absolute path within the doc. A sequence of IDs starting with the
 * VersionID in the Head. Immutable after construction */
export class Path {

  readonly ids: ReadonlyArray<ID>;

  constructor(ids: ReadonlyArray<ID>) {
    this.ids = ids;
  }

  static readonly empty = new Path([]);

  /** extend path downward */
  down(id: ID): Path {
    return new Path([...this.ids, id]);
  }

  /** path equality */
  equals(other: Path) {
    return (
      this.ids.length === other.ids.length
      && this.ids.every((id, i) => id === other.ids[i]));
  }

  /** Whether other path is within but not equal to this path */
  contains(other: Path): boolean {
    return (
      // must be longer
      other.ids.length > this.ids.length
      // not in our metadata
      && !(other.ids[this.ids.length] instanceof MetaID)
      // must extend this path
      && this.ids.every((id, i) => id === other.ids[i]));
  }

  containsOrEquals(other: Path): boolean {
    return this.equals(other) || this.contains(other);
  }


  /**
  * Path translation. Paths within a deep copy get translated, so that any path
  * contained in the source of the copy gets translated into a path contained in
  * the destination.
  */
  translate(src: Path, dst: Path): Path {
    // must be absolute path
    assert(this.ids[0] instanceof VersionID);
    if (src.contains(this)) {
      // translate from src to dst
      return new Path([...dst.ids, ...this.ids.slice(src.ids.length)]);
    }
    // disallow destination from "capturing" path outside src into dst
    // this should be caught during static analysis as a cyclic reference
    assert(!dst.contains(this));
    return this;
  }

  // dump path as dotted string
  dump() { return this.ids.join('.'); }
}

/** Path as a value of an item. Only used in metadata */
export class PathValue extends Base {
  path!: Path;

  /** make copy, bottom up, translating paths contextually */
  copy(src: Path, dst: Path): this {
    let to = another(this);
    to.path = this.path.translate(src, dst);
    return to;
  }

  equals(other: any) {
    return other instanceof PathValue && this.path.equals(other.path);
  }

  dump() { return this.path.dump(); }
}
