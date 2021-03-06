import { Block, FieldID, Head, Field, arrayLast, Item, Workspace } from "./exports";

/** History is the top value of a Space. The History is a Block whose fields
 * have a VersionID and contain a Head */
export class History extends Block<Version> {
  declare containingItem: Workspace;
  get workspace() { return this.containingItem; }

  get versions() {
    return this.items;
  }

  get currentVersion(): Version {
    return arrayLast(this.versions);
  }

  // dump current version
  dump() { return this.currentVersion.dump()}
}

/** Version is a Field with a VersionID and containing a Head */
export class Version extends Field<VersionID, Head> {
  _version = this;

  // versions are all outputs
  isInput = false;

  /** array of items with edit errors */
  get editErrors(): Item[] {
    let errors: Item[] = [];
    for (let item of this.visit()) {
      if (item.editError) {
        errors.push(item);
      }
    }
    return errors;
  }

  /** Array of edit error messages */
  get editErrorMessages(): string[] {
    return (this.editErrors
      .map(item => item.path.dumpInVersion() + ': ' + item.originalEditError)
    )
  }
}

/** space-unique ID of a Version */
export class VersionID extends FieldID {
}

