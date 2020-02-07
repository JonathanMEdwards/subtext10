import { Block, FieldID, Item, Value, Dictionary, assert, assertDefined, Field } from "./exports";

/** Metadata on an Item, containing fields with MetafieldID, and whose names all
 *start with '^' */
export class Metadata extends Block<Metafield> {

  /** logical container is base item's logical container */
  get up(): Item | undefined {
    return this.item.up;
  }

  /** sets a metadata field, which must not already exist */
  set(name: string, value: Value): Metafield {
    let id = assertDefined(MetaID.ids[name]);
    assert(!this.getMaybe(id));
    let field = new Metafield;
    this.fields.push(field)
    field.container = this;
    field.id = id;
    // define as literal output field (a constant)
    field.isInput = false;
    field.value = value;
    field.value.item = field;
    return field;
  }

}

export class Metafield extends Field<MetaID> {

}

/** Globally-unique ID of a MetaField. Name starts with '^'. Immutable and
 * interned. */
export class MetaID extends FieldID {
  // MetaID doesn't use a serial #. Instead the name is the globally unique ID.
  constructor(name: string) {
    super(NaN);
    this.name = name;
  }

  /** predefined metadata IDs */
  static ids: Dictionary<MetaID> = {
    '^~': new MetaID('^~'),                 // Extra results
    '^literal': new MetaID('^literal'),     // Literal formula
    '^reference': new MetaID('^reference'), // Reference formula
    '^code': new MetaID('^code'),           // Code block
  }
}