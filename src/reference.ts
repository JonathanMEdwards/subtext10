import { arrayEquals, Base, Token, Path, Item, assert, MetaID, PendingValue, trap, Block, StaticError, ID, arrayLast, another } from "./exports";

/** Guard on an ID in a reference */
type Guard = '?' | '!' | undefined;

/** Reference to another item in a formula. Only used in metadata, determining
 * the value of the metadata's base item.
 *
 * References are either structural or dependent. A structural reference is to
 * another item within a container of the base item. The syntax of a structural
 * reference starts with a field name, which is lexically bound. A dependent
 * reference is a path within the previous value of the base item. The
 * structural path to the previous item is prefixed to a dependent reference.
 * The syntax of a dependent reference starts with a '.', or '~'.
 */
export class Reference extends Base {

  /** whether reference is structural or dependent */
  structural!: boolean;

  /** Tokens of path in source. May have leading 'that' token. Name tokens have
   * leading ^ and trailing ?/!. '~' token used for extra results. Number tokens
   * used for testing */
  tokens!: Token[];

  /** Path to follow */
  path!: Path;

  /** index in path to end of contextual part of path. In an structural
   * reference, the context is the LUB container of the base and target items.
   * In a dependent reference, the context is the path of the previous value */
  context!: number;

  /** guards for each ID in path. Context is unguarded */
  guards!: Guard[];

  /** target item of reference */
  target?: Item;

  /** Evaluate reference */
  eval() {
    if (this.target) {
      // already evaluated
      return;
    }

    // References only exist in metadata
    assert(this.id instanceof MetaID);
    // Reference is dependent to base item
    let from = this.containingItem.container.containingItem;

    if (!this.path) {
      // bind path
      this.bind(from);
    }

    // dereference
    let target: Item = from.space;
    this.path.ids.forEach((id, i) => {
      let guard = this.guards[i];
      target = target.get(id);

      if (this.path.ids[i + 1] instanceof MetaID) {
        // metadata is not inside base item, so skip evaluating it
        return;
      }

      // TODO - check guards from LUB

      // evaluate on way down if value undefined
      target.evalIfNeeded();

      if (target.value instanceof PendingValue) {
        // cyclic dependency - should have been caught during binding
        trap();
      }
    })
    // evaluate target deeply
    target.eval();

    this.target = target;
  }

  // bind reference during analysis
  private bind(from: Item) {
    assert(this.space.analyzing);
    assert(this.tokens && this.tokens.length);

    // strip out guards from names
    let tokenNames: string[] = [];
    let tokenGuards: Guard[] = [];
    this.tokens.forEach(token => {
      let suffix = token.text.slice(-1);
      switch (suffix) {
        case '?':
        case '!':
          tokenGuards.push(suffix);
          tokenNames.push(token.text.slice(0, -1));
          return;
        default:
          tokenGuards.push(undefined);
          tokenNames.push(token.text);
          return;
      }
    });

    // reference is dependent if starts with 'that'
    this.structural = this.tokens[0].type !== 'that';
    let target: Item | undefined;

    if (this.structural) {
      /** bind first name of structural reference lexically by searching upward
       * to match first name. Note upwards scan skips from metadata to base
       * item's container */
      let first = tokenNames[0];
      for (let up of from.upwards()) {
        // bind against field names in Block container
        if (
          up.value instanceof Block
          && up.value.fields.find(field => field.name === first)
        ) {
          // set lexical scope
          target = up;
          break;
        }
        continue;
      }
      if (!target) {
        // hit top without binding
        // FIXME: search builtins, maybe generalized to includes at every level?

        throw new StaticError(this.tokens[0], 'Undefined name')
      }
    } else {
      // bind dependent reference within previous value
      target = from.previous();
      if (!target) {
        throw new StaticError(this.tokens[0], 'No previous value');
      }
    }

    // target is context of path, which is unguarded
    let ids: ID[] = target.path.ids.slice();
    let guards: Guard[] = ids.map(() => undefined);
    this.context = ids.length;

    // follow path downwards from context, advancing target
    for (let i = 0; i < this.tokens.length; i++) {
      let token = this.tokens[i];
      let name = tokenNames[i];
      let guard = tokenGuards[i];

      if (token.type === 'that') {
        // skip leading that in dependent path
        assert(i === 0 && !this.structural);
        continue;
      } else if (name[0] === '^') {
        // next name is metadata - don't evaluate base item
      } else {
        // evaluate target if needed
        target.evalIfNeeded();
        if (target.value instanceof PendingValue) {
          // cyclic dependency
          throw new StaticError(this.tokens[i], 'Circular reference')
        }
        if (name === '~') {
          // access extra results in metadata
          name = '^~';
        }
      }

      target = target.value!.getMaybe(name);
      if (!target) {
        // undefined name
        throw new StaticError(token, 'Undefined name')
      }

      // append to path
      ids.push(target.id);
      guards.push(guard);
    }

    if (target.value instanceof PendingValue) {
      // cyclic dependency
      throw new StaticError(arrayLast(this.tokens), 'Circular reference')
    }

    // establish Path
    this.path = new Path(ids);
    this.guards = guards;

    // LUB of structural path must be same as lexical scope
    if (this.structural) {
      let lub = this.path.lub(from.path);
      if (lub.length !== this.context) {
        throw new StaticError(this.tokens[0], 'Structural path scope too high')
      }
      // TODO: allow higher lexical binding, perhaps to avoid shadowing
      // this.context = lub.length;
      // // no guards used on context
      // // TODO report invalid guards in terms of tokens
      // assert(
      //   this.guards.slice(0, this.context).every(
      //     guard => guard === undefined
      //   )
      // )
    }
  }


  /** make copy, bottom up, translating paths contextually */
  copy(src: Path, dst: Path): this {
    // path must already have been bound
    assert(this.path);
    let to = another(this);
    to.tokens = this.tokens;
    to.structural = this.structural;
    to.path = this.path.translate(src, dst);
    // translate guards
    if (src.contains(this.path)) {
      // Adjust unguarded accesses to context
      assert(
        this.guards.slice(0, src.length)
          .every(guard => guard === undefined)
      );

      to.guards = [
        ...dst.ids.map(_ => undefined),
        ...this.guards.slice(src.length)
      ];

      to.context = this.context + dst.ids.length - src.length;
    } else {
      to.guards = this.guards;
      to.context = this.context;
    }
    return to;
  }

  equals(other: any) {
    return (
      other instanceof Reference
      && this.path.equals(other.path)
      && arrayEquals(this.guards, other.guards)
    );
  }

  // dump path as dotted string
  // Leave off versionID if in same version
  // FIXME: add guards
  dump() {
    let ids = this.path.ids;
    if (ids[0] === this.containingItem.path.ids[0]) {
      ids = ids.slice(1);
    }
    return ids.join('.');
    // dump source path
    // if (this.tokens[0].text === '.') {
    //   return '.' + this.tokens.slice(1).join('.');
    // }
    // return this.tokens.join('.');
  }
}