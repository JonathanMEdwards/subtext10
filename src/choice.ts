import { Block, trap, assert, StaticError, Path, Dictionary } from "./exports";

/** A Choice is a sum (discriminated union). It is a block where all the fields
 * (called options) are inputs, and exactly one of them is "chosen", meaning it
 * has a value and is accessible with a ?-guarded path */
export class Choice extends Block {

  /** index of choice. defaults to first choice */
  choiceIndex: number = 0;

  get choice() {
    return this.fields[this.choiceIndex];
  }

  /** set choice. Unchoosen options are initialized */
  setChoice(index: number) {
    this.choice.initialize();
    this.choiceIndex = index;
  }

  /** initialize to first value */
  initialize() {
    this.setChoice(0);
  }

  /** evaluate */
  eval() {
    if (!this.workspace.analyzing) {
      // evaluate choice
      this.choice.eval();
      return;
    }
    // analyze all choices
    this.fields.forEach(field => {
      // TODO: defer analysis of secondary choices
      assert(field.isInput && field.conditional);
      field.eval();
    })
  }

  /** value equality */
  equals(other: any) {
    return (
      other instanceof Choice
      && this.choiceIndex == other.choiceIndex
      && this.choice.equals(other.choice)
    )
  }

  copy(srcPath: Path, dstPath: Path): this {
    let to = super.copy(srcPath, dstPath);
    to.choiceIndex = this.choiceIndex;
    return to;
  }

  // dump as an object
  dump() {
    return { [this.choice.name!]: this.choice.dump() };
  }
}