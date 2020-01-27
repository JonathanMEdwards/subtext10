import { Value, another, Path } from "./exports";

/** Base items contain no other items */
export abstract class Base extends Value {

}

/**
 * A JS number.
 * NaN is the missing number _number_ which is equal to itself.
 */
export class Numeric extends Base {
  value: number = NaN;

  copy(src: Path, dst: Path): this {
    let to = super.copy(src, dst);
    to.value = this.value;
    return to;
  }

  equals(other: any) {
    return (
      other instanceof Numeric
      && (
        this.value === other.value
        || (Number.isNaN(this.value) && Number.isNaN(other.value))));
  }
}

export class Character extends Base {
  /**
   * a single-character string.
   * could be a charCode instead
   */
  value: string = ' ';

  copy(src: Path, dst: Path): this {
    let to = super.copy(src, dst);
    to.value = this.value;
    return to;
  }

  equals(other: any) {
    return other instanceof Character && this.value === other.value;
  }
}

/** Nil is the unit type with one value */
export class Nil extends Base {

  equals(other: any) {
    return other instanceof Nil;
  }

}

/** Anything is the top type used in generics */
export class Anything extends Base {

  equals(other: any) {
    return other instanceof Anything;
  }
}