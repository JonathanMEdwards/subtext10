import { Container, ID, Item, isNumber } from "./exports";

/** A Block is a record-like container with a fixed set of items called fields.
 * Each field can have a different type. Each Field has a globally unique
 * FieldID which optionally gives it a name. */

export class Block<F extends Field = Field> extends Container<F> {

  get fields() {
    return this.items;
  }

  /** the item with an ID else undefined */
  get(id: ID): F | undefined {
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
    return this.fields.find(field => field.id.name === id);
  }

}

/** Field is an Item with a BlockID */
export class Field extends Item<FieldID> {

}

/** document-unique ID of a Field. Immutable and interned */
export class FieldID {
  /** name of field. undefined is unnamed */
  name?: string;

  constructor(name?: string) {
    this.name = name;
  }
}