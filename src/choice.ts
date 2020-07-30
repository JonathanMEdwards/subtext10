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
    assert(index >= 0 && index < this.fields.length);
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
    // validate option definitions
    this.fields.forEach(option => {
      assert(option.io === 'input' && option.conditional);
    })
    // analyze first option
    this.fields[0].eval();
    // defer analysis of rest of options to permit recursion
    this.fields.slice(1).forEach(option => {
      if (option.evaluated || option.deferral) {
        // skip options that are already evaluated or deferred
        return;
      }
      option.evaluated = undefined
      option.deferral = (
        () => { option.eval(); }
      )
      this.workspace.analysisQueue.push(option);
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