import { assert, Container, ID, Item, isNumber, Token, Path, Dictionary, Value, trap, StaticError } from "./exports";

/** A Block is a record-like container with a fixed set of items called fields.
 * Each field can have a different type. Each Field has a globally unique
 * FieldID which optionally gives it a name. */

export class Block<F extends Field = Field> extends Container<F> {

  /** whether block is displayed as an outline or a single line */
  outlined = true;

  get fields(): F[] {
    return this.items;
  }

  /** add a Field */
  add(field: F) {
    this.fields.push(field);
    assert(!field.container);
    field.container = this;
  }

  /** the item with an ID else undefined */
  getMaybe(id: ID): F | undefined {
    if (id instanceof FieldID) {
      return this.fields.find(field => field.id === id);
    }
    if (isNumber(id)) {
      // use number as ordinal index
      return this.fields[id - 1];
    }
    let ordinal = Number(id)
    if (Number.isFinite(ordinal)) {
      // convert string to ordinal
      return this.fields[ordinal - 1];
    }
    // search by name
    return this.fields.find(field => field.name === id);
  }

  /** evaluate all fields */
  eval() {
    this.fields.forEach(field => {
      field.eval();
      if (this.workspace.analyzing) {
        if (field.isInput && field.conditional) {
          throw new StaticError(field, 'input fields must be unconditional')
        }
        // verify conditional naming
        if (
          field.id.name && field.id.token
          && field.id.token.text.endsWith('?') !== !!field.conditional
        ) {
          throw new StaticError(
            field,
            field.conditional
              ? 'conditional field name must have suffix ?'
              : 'unconditional field name cannot have suffix ?'
          )
        }
      }
    })
  }

  /** initialize all values */
  initialize() {
    this.fields.forEach(field => field.initialize());
  }

  copy(srcPath: Path, dstPath: Path): this {
    let to = super.copy(srcPath, dstPath);
    to.outlined = this.outlined;
    return to;
  }

  /** whether contains an input field with an Anything value */
  get isGeneric() {
    return this.fields.some(field => field.isInput && field.value!.isGeneric)
  }

  // type compatibility
  changeableFrom(from: Block, fromPath: Path, thisPath: Path) {
    return (
      super.changeableFrom(from, fromPath, thisPath)
      && this.fields.length === from.fields.length
      && this.fields.every((field, i) =>
        field.changeableFrom(from.fields[i], fromPath, thisPath))
    )
  }

  // dump as an object
  dump() {
    let obj: Dictionary<unknown> = {};
    this.fields.forEach((field, i) => {
      // skip includes
      if (field.formulaType === 'include') return;
      // rejected fields are dumped as false
      obj[field.name ?? i + 1] = field.rejected ? false : field.dump();
    })
    return obj;
  }
}

/** Field is an Item with a FieldID and a Value */
export class Field<I extends FieldID = FieldID, V extends Value = Value> extends Item<I, V> {

  get name() { return this.id.name }
}

/** space-unique ID of a Field. Immutable and interned */
export class FieldID {

  /** space serial # of field */
  readonly serial: number;

  /** name of field, without trailing ?. undefined if unnamed */
  name?: string;

  /** source token where defined, for parsing errors */
  token?: Token;

  constructor(serial: number) {
    this.serial = serial;
  }

  toString() {
    return this.name ?? this.serial.toString();
  }
}

/** data block */
export class Record extends Block {
  private _nominal: undefined;
}