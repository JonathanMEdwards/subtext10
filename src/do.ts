import { Block } from "./exports";

/** A Code block is executed to produce a result value. The fields of the block
 * are called statements */
export abstract class Code extends Block {

  /** analysis state, only used during analysis */
  analysis: 'pending' | 'complete' = 'pending';

  /** execute code */
  execute() {

  }





}

/** A Do block is a procedure that executes statements sequentially */
export class Do extends Code {

}