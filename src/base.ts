import { Value, Path, assert } from "./exports";

/** Base items contain no other items */
export abstract class Base extends Value {

  // base values already evaluated by default
  eval() { }

  initialize() { }

  dump() { }

  // Validate copy test
  isCopyOf(ancestor: this): boolean {
    if (super.isCopyOf(ancestor)) {
      assert(this.equals(ancestor))
      return true;
    } else {
      return false;
    }
  }

}

/**
 * A JS number.
 * NaN is the blank number `###` which is equal to itself.
 */
export class _Number extends Base {
  value: number = NaN;

  isBlank() { return Number.isNaN(this.value); }

  copy(srcPath: Path, dstPath: Path): this {
    let to = super.copy(srcPath, dstPath);
    to.value = this.value;
    return to;
  }

  equals(other: any) {
    return (
      other instanceof _Number
      && (
        this.value === other.value
        || this.isBlank() && other.isBlank()));
  }

  // dump as number
  dump() { return this.value };
}

/** a JS character */
export class Character extends Base {
  /** value is a single-character string. could be a charCode instead */
  value: string = ' ';

  // space is the blank value
  isBlank() { return this.value === ' '; }

  copy(srcPath: Path, dstPath: Path): this {
    let to = super.copy(srcPath, dstPath);
    to.value = this.value;
    return to;
  }

  equals(other: any) {
    return other instanceof Character && this.value === other.value;
  }

  // dump as string
  dump() { return this.value };
}

/** Nil is the unit type with one value */
export class Nil extends Base {

  isBlank() { return true; }

  // JS value is null
  get value() { return null };

  equals(other: any) {
    return other instanceof Nil;
  }

  // dump as null
  dump() { return null };
}

/** Anything is the top type used in generics */
export class Anything extends Base {

  isBlank() { return true; }

  equals(other: any) {
    return other instanceof Anything;
  }

  get isGeneric() { return true }

  // anything is compatible
  updatableFrom(from: Value, fromPath?: Path, thisPath?: Path): boolean {
    return true;
  }

  // dump as undefined
  dump() { return undefined };
}