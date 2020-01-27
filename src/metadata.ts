import { Block, FieldID, Item } from "./exports";

/** Metadata on an Item, containing fields with MetafieldID, and whose names all
 *start with '^' */
export class Metadata extends Block<MetaField> {

}

/** Field is an Item with a BlockID */
export type MetaField = Item<MetaID>;

/** document-unique ID of a MetaField. Name starts with '^'. Immutable and interned */
export class MetaID extends FieldID {
  constructor(name: string) {
    super(name);
  }
}