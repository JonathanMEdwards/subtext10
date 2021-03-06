import { Block, FieldID, Item, Value, Dictionary, assert, assertDefined, Field, Reference, cast, Text, Choice, CompileError, ID, OptionReference, Path } from "./exports";

/** Metadata on an Item, containing fields with MetafieldID, and whose names all
 *start with '^' */
export class Metadata extends Block<Metafield> {

  /** logical container is base item's logical container */
  get up(): Item {
    return this.containingItem.up;
  }

  /** sets a metadata field, which must not already exist. Value must be
   * detached or undefined. */
  set(name: string, value?: Value): Metafield {
    let id = assertDefined(MetaID.ids[name]);
    assert(!this.getMaybe(id));
    let field = new Metafield;
    this.fields.push(field)
    field.container = this;
    field.id = id;
    // define as literal output field (a constant)
    field.io = 'output';
    field.formulaType = 'none';
    if (value) {
      field.setValue(value);
    }

    return field;
  }
}

/** Special Metadata to contain ^delta Metafield, which is not stored in normal
 * metadata. Stored in Item.delta*/
export class DeltaContainer extends Metadata {
  get deltaField() { return this.items[0] }
}


export class Metafield extends Field<MetaID> {

  /** base field */
  get base(): Item {
    return this.container.containingItem;
  }

  /** Previous item in metadata is previous item of the base data. Except
   * ^payload goes to ^target */
  previous(): Item | undefined {
    this.usesPrevious = true;
    if (this.id === MetaID.ids['^payload']) {
      // previous value of payload is the target
      let ref = cast(
        this.container.get('^target').value,
        Reference);
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
  private constructor(name: string) {
    super(NaN);
    this.name = name;
  }

  private static define(names: string[]): Dictionary<MetaID> {
    let dict: Dictionary<MetaID> = {};
    names.forEach(name => {
      dict[name] = new MetaID(name)
    })
    return dict;
  }
  static ids: Dictionary<MetaID> = MetaID.define([
    '^literal',       // Literal formula
    '^reference',     // Reference formula
    '^code',          // Code block
    '^loop',          // Loop block
    '^target',        // target reference of := & -> & ::edits
    '^payload',       // Formula after :=
    '^source',        // Value in edit
    '^call',          // function call
    '^builtin',       // builtin call
    '^initial',       // initial value of item
    '^export',        // Exported value
    '^exportType',    // Exported value type
    '^writeValue',    // Formula before ->
    '^delta',         // Pending change in DeltaContainer
    '^extend',        // record extension
    '^any',           // generic selection
    '^moved',         // reference to move destination
  ]);
}