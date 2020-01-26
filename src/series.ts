import { Container, ID } from "./exports";

/** A Series is a dynamic sequence of items of a fixed type */
export class Series extends Container {



}
/** Series-unique ID of an item. A monotonic serial number within the series */
export class SeriesID extends ID {
  serial = 0

}
