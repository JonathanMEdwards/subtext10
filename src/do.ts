import { Block, arrayLast, Field, assert } from "./exports";

/** A Code block is evaluated to produce a result value. The fields of the block
 * are called statements */
export class Code extends Block {

  /** final result field of block */
  result!: Field;

  eval() {
    assert(!this.result);

    // evaluate all fields
    // TODO: stop on rejection
    super.eval();

    // set result to last field
    // TODO: set result to previous field
    this.result = arrayLast(this.fields);
  }


}

/** A Do block is a procedure that evaluates statements sequentially */
export class Do extends Code {

}