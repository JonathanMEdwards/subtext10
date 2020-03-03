import { arrayEquals, Base, Token, Path, Item, assert, MetaID, trap, Block, StaticError, ID, arrayLast, another, Value, cast, Call, Do, Code, Crash, Statement, Choice } from "./exports";

/** Guard on an ID in a reference */
export type Guard = '?' | '!' | undefined;

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

  /** Tokens of path in source. May have leading 'that' token. Name tokens have
   * leading ^ and trailing ?/!. '~' token used for extra results.
   * Special tokens used for binding calls: call, arg1, arg2, input.
   * Number tokens are used for testing */
  tokens!: Token[];

  /** reference is dependent if starts with 'that' */
  get dependent() { return this.tokens[0].type === 'that' }


  /** Path to follow */
  path!: Path;

  /** index in path to end of contextual part of path. In a structural
   * reference, the context is the LUB container of the base and target items.
   * In a dependent reference, the context is the path of the previous value.
   * The contextual part of the path is unguarded, and we avoid evaluating it to
   * prevent evaluation cycles.
   * */
  context!: number;

  /** guards for each ID in path. Context is unguarded */
  // TODO: only record context part of path?
  guards!: Guard[];

  /** pointer to target item of reference (not a copy). Derived during eval, not
   * copied */
  target?: Item;

  /** whether reference is conditional within path */
  conditional = false;

  /** whether reference was rejected. Derived, not copied */
  rejected = false;

  /** Evaluate reference */
  eval() {
    if (this.target || this.rejected) {
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
    let target: Item = from.workspace;
    this.path.ids.forEach((id, i) => {
      target = target.get(id);

      if (this.path.ids[i + 1] instanceof MetaID) {
        // metadata is not inside base item, so skip evaluating it
        return;
      }

      // mark code statements used
      if (target instanceof Statement) {
        target.used = true;
      }

      // evaluate on way down if needed
      this.evalIfNeeded(target);

      // check guards within context
      if (i >= this.context) {
        let guard = this.guards[i];
        assert(!!guard === target.conditional);
        if (
          target.rejected || (
            target.container instanceof Choice
            && target !== target.container.choice
          )
        ) {
          // reject reference
          this.rejected = true;
          if (!this.workspace.analyzing) {
            if (guard === '!') {
              throw new Crash(this.tokens[i - this.context], 'assertion failed')
            }
            return;
          }
          // during analysis follow path to get type of result
        }
      }
    })

    // evaluate final target deeply
    target.eval();

    this.target = target;
  }

  /** evaluate item if needed to dereference */
  private evalIfNeeded(item: Item) {
    if (!item.value && !item.rejected) {
      item.eval();
    }
    // resolve deferred item
    item.resolve();
  }

  // bind reference during analysis
  private bind(from: Item) {
    assert(this.workspace.analyzing);
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

    let target: Item | undefined;

    if (this.tokens[0].type === 'input') {
      /** bind to input of a call.
       * This occurs on ^rhs^reference of Call.
       * Possibly could generalize to outer-that.
       * */
      assert(this.tokens.length === 1);
      assert(from.id.toString() === '^rhs');
      let change = from.container.containingItem;
      assert(change.formulaType === 'changeInput');
      assert(change.container instanceof Call);
      let call = change.container.containingItem;
      assert(call.id.toString() === '^call');
      target = this.previous(call, this.tokens[0]);
      if (target.evaluated === undefined) {
        throw new StaticError(this.tokens[0], 'Circular reference')
      }
      this.path = target.path;
      this.context = this.path.length;
      this.guards = this.path.ids.map(() => undefined);
      return;
    }

    if (this.dependent) {

      // bind dependent reference within previous value
      target = this.previous(from, this.tokens[0]);
    } else {
      /** bind first name of structural reference lexically by searching upward
       * to match first name. Note upwards scan skips from metadata to base
       * item's container. Also looks one level into includes */
      let first = tokenNames[0];
      lexicalBinding: for (let up of from.upwards()) {
        if (up.value instanceof Block) {
          for (let field of (up.value as Block).fields) {
            if (field.name === first) {
              target = up;
              break lexicalBinding;
            }
            // bind against included fields too
            if (field.formulaType === 'include') {
              assert(field.value instanceof Block);
              for (let included of (field.value as Block).fields) {
                if (included.name === first) {
                  target = field;
                  break lexicalBinding;
                }
              }
            }
          }
        }
      }
      if (!target) {
        // hit top without binding
        throw new StaticError(this.tokens[0], 'Undefined name')
      }
    }

    // target is context of path, which is unguarded
    let ids: ID[] = target.path.ids.slice();
    let guards: Guard[] = ids.map(() => undefined);
    this.context = ids.length;

    // follow path downwards from context, advancing target
    for (let i = 0; i < this.tokens.length; i++) {
      let token = this.tokens[i];
      let type = token.type;
      let name = tokenNames[i];
      let guard = tokenGuards[i];

      if (type === 'that') {

        // skip leading that in dependent path
        assert(i === 0 && this.dependent);
        continue;
      } else if (name[0] === '^') {

        // don't evaluate base item on path into metadata
        if (tokenGuards[i - 1] !== undefined) {
          throw new StaticError(
            this.tokens[i - 1],
            'No guard allowed before metadata'
          );
        }
      } else if (type === 'call') {

        if (target.evaluated === undefined) {
          // illegal recursion
          // FIXME - appears now caught by evaling reference
          trap();
          // throw new Crash(
          //   this.tokens[i - 1],
          //   'recursion outside secondary try clause'
          // );
        }

        // dereferences formula body in a call
        let call = target.getMaybe('^code');
        if (!call || !(call.value instanceof Do)) {
          throw new StaticError(token, 'Can only call a do-block');
        }

        // erase guard from base field. Call.guard will check it
        // note conditional access will have been checked on the base field
        guards.pop();
        guards.push(undefined);
        // fall through to name lookup
        name = '^code';
      } else {

        // follow path into value
        // evaluate target if needed
        this.evalIfNeeded(target);
        if (!target.value) {
          // cyclic dependency
          // FIXME - Don't think this can happen anymore
          trap();
          // throw new StaticError(token, 'Circular reference')
        }
        if (name === '~') {
          // access extra results in metadata
          name = '^~';
        }
      }

      if (type === 'arg1' || type === 'arg2') {

        // positional call argument
        target = (
          target.value instanceof Do
            ? target.value.fields[type === 'arg1' ? 0 : 1]
            : undefined
        )
        if (!target || !target.isInput) {
          throw new StaticError(token, 'Program input not defined')
        }
      } else {

        // dereference by name
        target = target.getMaybe(name);
        if (!target) {
          // undefined name
          throw new StaticError(token, 'Undefined name')
        }
        this.evalIfNeeded(target);
        if (!target.value) {
          // cyclic dependency
          let lastToken = arrayLast(this.tokens);
          if (lastToken.type === 'call') {
            throw new StaticError(lastToken, 'Recursive call outside secondary try clause')
          }
          throw new StaticError(lastToken, 'Circular reference')
        }

        // check conditional access
        let conditional = !!target.conditional;
        if (target.container instanceof Code && !target.isInput) {
          // FIXME: only allow backward references within code
          // FIXME: outside references to outputs are conditionalized on block
          assert(target.container.containingItem.path.contains(from.path));
          conditional = false;
        }
        if (!!guard !== conditional) {
          throw new StaticError(
            token,
            guard
              ? `invalid reference suffix ${guard}`
              : 'conditional reference lacks suffix ? or !'
          );
        }
        if (conditional && guard === '?') {
          // reference only conditional with ? suffix. ! crashes
          this.conditional = true;
        }
      }

      // append to path
      ids.push(target.id);
      guards.push(guard);
    }

    target.resolve();
    if (target.evaluated === undefined) {
      // cyclic dependency
      throw new StaticError(arrayLast(this.tokens), 'Circular reference')
    }

    // establish Path
    this.path = new Path(ids);
    this.guards = guards;

    /** FIXME: path context is not necessarily the LUB of base and target of
     * ref. This could happen because the path climbed back down the upward path
     * to the lexical binding. It can also happen when binding to inclusions.
     * This may matter for allowing access to conditional fields.
     *
    */
    // LUB of structural path must be same as lexical scope
    // if (!this.dependent) {
      // let lub = this.path.lub(from.path);
      // if (lub.length !== this.context) {
      //   throw new StaticError(this.tokens[0], 'Structural path scope too high')
      // }
      // TODO: allow higher lexical binding, perhaps to avoid shadowing
      // this.context = lub.length;
      // // no guards used on context
      // // TODO report invalid guards in terms of tokens
      // assert(
      //   this.guards.slice(0, this.context).every(
      //     guard => guard === undefined
      //   )
      // )
    // }
  }

  /** reference previous value, disallow if a data block conditional. This is OK
   * in code block because will already have rejected
   *
   * TODO: maybe allow 'that?' and 'that!' to explicitly guard previous
   * reference in data block.
   */

  private previous(from: Item, token: Token): Item {
    let item = from.previous();
    if (!item) {
      throw new StaticError(token, 'No previous value');
    }
    if (
      item.conditional
      && !(item.container instanceof Code)
      && !(item.container instanceof Choice)
    ) {
      // in data block, prev value can't be conditional
      throw new StaticError(
        token,
        'Previous value is conditional: use explicit guarded reference'
      )
    }
    return item;
  }

  initialize() {
    this.rejected = false;
    this.target = undefined
  }

  /** make copy, bottom up, translating paths contextually */
  copy(srcPath: Path, dstPath: Path): this {
    // path must already have been bound
    assert(this.path);
    let to = another(this);
    to.tokens = this.tokens;
    to.path = this.path.translate(srcPath, dstPath);
    // translate guards
    if (srcPath.contains(this.path)) {
      // Adjust unguarded accesses to context
      assert(
        this.guards.slice(0, srcPath.length)
          .every(guard => guard === undefined)
      );

      to.guards = [
        ...dstPath.ids.map(() => undefined),
        ...this.guards.slice(srcPath.length)
      ];

      to.context = this.context + dstPath.ids.length - srcPath.length;
    } else {
      to.guards = this.guards;
      to.context = this.context;
    }
    return to;
  }

  /** References are the same type if they reference the same location
   * contextually */
  changeableFrom(from: Value, fromPath: Path, thisPath: Path): boolean {
    return (
      from instanceof Reference
      // FIXME: compare translated guards
      && arrayEquals(this.guards, from.guards)
      && this.path.equals(from.path.translate(fromPath, thisPath))
    )
  }

  // equality assumes changeableFrom is true, which requires equality
  equals(other: any) {
    return true;
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