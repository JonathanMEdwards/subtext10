import { Block } from "./exports";

/** A Choice is a sum (discriminated union). It is a block where all the fields
 * (called options) are inputs, and exactly one of them is "chosen", meaning it
 * has a value and is accessible with a ?-guarded path */
export class Choice extends Block {

}