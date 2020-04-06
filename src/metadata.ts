import { Block, FieldID, Item, Value, Dictionary, assert, assertDefined, Field, Reference, cast, Text, Choice, StaticError, ID, OptionReference } from "./exports";

/** Metadata on an Item, containing fields with MetafieldID, and whose names all
 *start with '^' */
export class Metadata extends Block<Metafield> {

  /** logical container is base item's logical container */
  get up(): Item | undefined {
    return this.containingItem.up;
  }

  /** sets a metadata field, which must not already exist. Value can be undefined. */
  set(name: string, value?: Value): Metafield {
    let id = assertDefined(MetaID.ids[name]);
    assert(!this.getMaybe(id));
    let field = new Metafield;
    this.fields.push(field)
    field.container = this;
    field.id = id;
    // define as literal output field (a constant)
    field.isInput = false;
    field.formulaType = 'none';
    if (value) {
      field.setValue(value);
    }

    return field;
  }

}

export class Metafield extends Field<MetaID> {

  /** Previous item in metadata is previous item of the base data. Except ^rhs
   * goes to ^lhs */
  previous(): Item | undefined {
    this.usesPrevious = true;
    if (this.id === MetaID.ids['^rhs']) {
      // previous value of rhs is the lhs
      let lhs = assertDefined(this.container.getMaybe('^lhs'));
      let ref = cast(lhs.value, Reference);
      // should already have been dereferenced
      let target = assertDefined(ref.target);
      if (ref instanceof OptionReference) {
        // get initial value of option
        assert(ref.optionID);
        let option = target.get(ref.optionID);
        assert(option.container instanceof Choice);
        // use initial value of option, not current value
        return option.get('^initial');
      }
      return target;
    }
    // previous value of base item
    return this.container.containingItem.previous();
  }
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
    '^literal': new MetaID('^literal'),       // Literal formula
    '^reference': new MetaID('^reference'),   // Reference formula
    '^code': new MetaID('^code'),             // Code block
    '^loop': new MetaID('^loop'),             // Loop block
    '^lhs': new MetaID('^lhs'),               // Dependent reference before :=
    '^rhs': new MetaID('^rhs'),               // Formula on right of :=
    '^call': new MetaID('^call'),             // function call
    '^builtin': new MetaID('^builtin'),       // builtin call
    '^initial': new MetaID('^initial'),       // initial value of item
    '^export': new MetaID('^export'),         // Exported value
    '^exportType': new MetaID('^exportType'), // Exported value type
  }
}