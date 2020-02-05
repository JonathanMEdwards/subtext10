import { assert, Block, Choice, Code, Field, FieldID, Head, Numeric, stringUnescape, SyntaxError, Text, Token, tokenize, TokenType, Value, Nil, Anything, Record, Space, Reference } from "./exports";

/**
 * Recursive descent parser.
 *
 * Methods starting with 'parse': A succesful parse returns a defined value and
 * advances the cursor. A failed parse returns undefined, leaves the cursor
 * unchanged, and sets an error. An unrecoverable error throws a SyntaxError
 * exception.
 *
 * Methods starting with 'require' return a value and advance the cursor, or
 * else throw an error.
 *
 * Methods starting with 'match' will return a boolean and advance the cursor on
 * succcess, leaving the cursor unchanged on failure. They do not set an error.
 *
 * Methods starting with 'peek' return a boolean but do not advance the cursor
 * or set an error.
 */
export class Parser {
  /** @throws SyntaxError */
  constructor(readonly source: string) {
    this.tokens = tokenize(this.source);
    // append end token for convenience
    this.tokens.push(new Token('end', source.length, source.length, source));
  }

  private readonly tokens: Token[];

  /** advancing cursor in tokens */
  private cursor = 0;

  /** token at cursor */
  get cursorToken(): Token {
    return this.tokens[this.cursor]
  }
  /** token before cursor */
  get prevToken(): Token {
    return this.tokens[this.cursor - 1]
  }

  /** Farthest error so far */
  error?: SyntaxError;

  /**
   * Set error if farther than previous error
   * @param message
   * @param token location of error, defaults to cursor token
   * @returns SyntaxError
   */
  setError(message: string, token?: Token): SyntaxError {
    // set error to token start, else cursor token start, else end of source
    if (!token) {
      token = this.cursorToken;
    }
    let start = token ? token.start : this.source.length;
    if (this.error && this.error.cursor > start) {
      // preserve existing farther error
    } else {
      this.error = new SyntaxError(start, this.source, message);
    }
    return this.error;
  }

  space!: Space;

  /** require top-level Head definition */
  requireHead(head: Head) {
    // store Space in Parser
    this.space = head.space;

    this.requireBlockBody(head);
    if (!this.peekToken('end')) {
      throw this.setError('Expecting top-level item definition');
    }
  }

  /** Require block with curly brackets */
  requireBlock(block: Block): Block {
    this.requireToken('{');
    this.requireBlockBody(block);
    this.requireToken('}');
    return block;
  }

  /**
   * Require body of block inside curly brackets. Terminated by } or end.
   * @param block new block to populate.
   */
  requireBlockBody(block: Block): void {
    // assume single-line block
    block.outlined = false;
    while (true) {
      // consume separators
      while (true) {
        if (this.matchToken(',')) continue;
        if (this.matchToken(';')) continue;
        if (this.matchToken('\n')) {
          block.outlined = true;
          continue;
        }
        break;
      }

      if (this.peekToken('}', 'end')) return;
      this.requireField(block);
      continue;
    }
  }


  /** Define a field in a block */
  requireField(block: Block): Field {
    const field = new Field;

    // dataflow qualifiers
    if (this.parseToken('let')) {
      field.dataflow = 'let';
    } else if (this.parseToken('check')) {
      field.dataflow = 'check';
      if (!(block instanceof Code)) {
        throw this.setError(
          'check only allowed in program blocks',
          this.prevToken);
      }
    } else if (this.parseToken('extra')) {
      field.dataflow = 'extra';
      if (!(block instanceof Code)) {
        throw this.setError(
          'extra only allowed in program blocks',
          this.prevToken);
      }
    }

    // name definition
    const cursor = this.cursor;
    if (this.parseToken('name') && this.parseToken(':', '=')) {
      // named field
      const nameToken = this.tokens[this.cursor - 2];
      const defType = this.prevToken.type;

      if (nameToken.text.startsWith('^')) {
        throw this.setError('Cannot define metadata', nameToken);
      } else if (nameToken.text.startsWith('~')) {
        throw this.setError('Cannot define extra result', nameToken);
      }

      // strip ending ? from name
      const conditional = nameToken.text.endsWith('?');
      const unqualName = (
        field.isConditional
          ? nameToken.text.slice(0, -1)
          : nameToken.text
      );

      // check name is unique
      if (block.getMaybe(unqualName)) {
        throw this.setError('Duplicate name', nameToken);
      }

      // FieldID allocated here becomes unique identifier for field
      field.id = this.space.newFieldID(unqualName, nameToken);
      field.isInput = (defType === ':');

      if (block instanceof Choice) {
        if (!conditional) {
          throw this.setError('Options must end in ?', nameToken);
        }
        if (!field.isInput) {
          throw this.setError(
            'Option must be an input defined with ":"', this.prevToken);
        }
      } else if (block instanceof Code) {
        if (conditional) {
          throw this.setError("Names in programs can't end with ?", nameToken);
        }
      }
    } else {
      // anonymous output formula
      this.cursor = cursor
      field.id = this.space.newFieldID (
        undefined,
        // = token pointing to start of formula
        new Token(
          '=',
          this.cursorToken.start,
          this.cursorToken.start,
          this.cursorToken.source
        )
      );
      field.isInput = false;
    }

    // add field to block
    block.add(field);

    // parse formula
    this.requireFormula(field);

    return field;
  }

  /** Parse a formula defining a field */
  requireFormula(field: Field): void {

    // literal value
    let value = this.parseLiteral();
    if (value) {
      if (field.isInput) {
        // literal input is stored as formula to allow reset
        field.setMeta('^formula', value);
      } else {
        // literal output stored directly in value of field without a formula
        // to avoid infinite regress
        field.value = value;
        value.container = field;
      }
      return;
    }

    // initial reference
    let ref = this.parseReference();
    if (ref) {
      field.setMeta('^formula', ref);
      // TODO: formulas
      return;
    }

    throw this.setError('expecting a formula')
  }



  //
  // requireExpr(field: Field): void {

  //   // parse subject value
  //   let pathStart = this.cursor;
  //   let value: Value | TokenPath | undefined;
  //   value = this.parsePath();
  //   let pathEnd = this.cursor;
  //   if (value === undefined) {
  //     value = this.parseLiteralMaybeFalsey();
  //     if (value === undefined) {
  //       if (!defaulting) {
  //         throw this.setError('Expecting value');
  //       }
  //       if (this.parseCode()) {
  //         // code{} - reparse with default value
  //         this.cursor = pathStart;
  //         value = [];
  //       } else {
  //         throw this.setError('Expecting value or function or code block');
  //       }
  //     }
  //   } else if (defaulting && !value[0].text.startsWith('$')) {
  //     // Resolve ambiguity when value can default and first value is a path
  //     // FIXME paths to function defs are not ambiguous, but not bound yet!
  //     // `path`
  //     if (isOperator(last(value).text) || this.peekToken('(')) {
  //       // `operator` or `fnc (` - reparse with default value
  //       this.cursor = pathStart;
  //       value = [];
  //     } else if (this.parsePath()) {
  //       // `path path`
  //       if (isOperator(this.prevToken.text) || this.peekToken('(')) {
  //         // `path op` or `path fnc (` - reparse with path as value
  //         this.cursor = pathEnd;
  //       } else if (this.parsePath()) {
  //         // `path path path` - ambiguous
  //         this.cursor = pathEnd;
  //         throw this.setError('Add parentheses to distinguish function from argument');
  //       } else if (this.parseLiteralMaybeFalsey() !== undefined) {
  //         // `path fnc literal` - reparse with path as value
  //         this.cursor = pathEnd;
  //       } else {
  //         // `fnc path` - reparse with default value
  //         this.cursor = pathStart;
  //         value = [];
  //       }
  //     } else if (this.parseLiteralMaybeFalsey() !== undefined) {
  //       // `fnc literal` - reparse with default value
  //       this.cursor = pathStart;
  //       value = [];
  //     } else if (this.parseCode()) {
  //       // 'path code{}' - reparse with path as value
  //       this.cursor = pathEnd;
  //     } else {
  //       // parse as single value
  //     }
  //   }

  //   // parse operations
  //   let ops = this.requireOps();
  //   if (ops.fields.length === 0) {
  //     // no calls
  //     if (value === undefined) {
  //       throw this.setError('Expecting something');
  //     }
  //     if ((field.mode === 'state' && value instanceof Container) ||
  //       field.mode !== 'state' && !isPath(value)) {
  //       // state absorbs containers into actual value
  //       // formula absorbs all literals into actual value
  //       // In both of these cases we dont need to remember defined value in metadata
  //       field.set(value);
  //       return;
  //     }
  //   } else if (ops.fields.length === 1) {
  //     // absorb single op into this field
  //     let call = ops.fields[0];
  //     field.setMeta('^function', prune(call.getMeta('^function')));
  //     field.setMeta('^arguments', prune(call.getMeta('^arguments')));
  //     field.setMeta('^code', prune(call.getMeta('^code')));
  //     field.setMeta('^call~', prune(call.getMeta('^call~')));
  //   } else {
  //     // multiple ops treated as a code block
  //     field.setMeta('^code', ops);
  //   }

  //   // store expression initial value in ^value
  //   assertDefined(value);
  //   field.setMeta('^value', value);
  // }

  // /**
  //  * Require 0 or more operations into a Formula code block.
  // */
  // requireOps(): Formula {
  //   let block = new Formula;
  //   while (true) {
  //     // leave at end of field/block/list/
  //     if (this.peekToken(',', '\n', ')', '}', 'end')) {
  //       return block;
  //     }
  //     let call = new SetCmd;
  //     block.add(call)
  //     call.name = new Name(block.fields.length, this.cursorToken);

  //     // set whole subject
  //     call.subjectPath = [];

  //     // default value
  //     call.setMeta('^value', []);

  //     // code block
  //     let code = this.parseCode();
  //     if (code) {
  //       // store code block in ^code
  //       call.setMeta('^code', code);
  //       continue;
  //     }

  //     // function path
  //     let fnc = this.parsePath();
  //     if (!fnc) {
  //       throw this.setError('Expecting function or code block');
  //     }
  //     call.setMeta('^function', fnc);

  //     // arguments
  //     let args = this.requireArgs();
  //     if (args.fields.length) {
  //       call.setMeta('^arguments', args);
  //     }
  //     if (this.prevToken.text === ')' && this.cursorToken.text === FormulaChar) {
  //       // (...)~ uses formula of call rather than result
  //       this.requireToken('name');
  //       call.setMeta('^call~', null);
  //     }

  //     continue;
  //   }
  // }


  // /** Require code block assigning arguments, possibly empty */
  // requireArgs(): Arguments {
  //   let args = new Arguments;
  //   if (!this.parseToken('(')) {
  //     // unparenthesized argument as single positional argument
  //     let arg = new SetCmd;
  //     args.add(arg);
  //     arg.name = new Name(1, this.prevToken);
  //     arg.subjectPath = [arg.name];
  //     // parse following value
  //     arg.setMeta('^value', this.requireValue());
  //     return args;
  //   }

  //   // parse multiple arguments inside parentheses
  //   // allow positional arguments at first
  //   let positional = true;
  //   while (true) {
  //     // consume separators
  //     while (this.matchToken(',') || this.matchToken('\n')) { }
  //     if (this.parseToken(')')) {
  //       // end
  //       return args;
  //     }
  //     // create a SetCmd, named ordinally
  //     let arg = new SetCmd;
  //     args.add(arg);
  //     arg.name = new Name(args.fields.length, this.cursorToken);

  //     let argStart = this.cursor;
  //     let path = this.parsePath();
  //     if (path && this.parseToken(':=')) {
  //       // keyword (or path) argument
  //       arg.subjectPath = path;
  //       this.requireFormula(arg, 'defaulting');
  //       positional = false;
  //       continue;
  //     }
  //     // reparse as positional argument
  //     arg.subjectPath = [arg.name];
  //     this.cursor = argStart;
  //     if (!positional) {
  //       throw this.setError('Expecting argument name')
  //     }
  //     this.requireFormula(arg, 'defaulting');
  //     continue;
  //   }
  // }

  // /** parse a code block */
  // parseCode(): Code | undefined {
  //   let token = this.parseToken(
  //     'do', 'try', 'generic', 'builtin', 'generic-builtin');
  //   if (!token) return undefined;
  //   let code: Code;
  //   switch (token.type) {
  //     case 'do':
  //       code = new Do;
  //       break;
  //     case 'generic':
  //       code = new Do;
  //       code.generic = true;
  //       break;
  //     case 'builtin':
  //       code = new Builtin;
  //       break;
  //     case 'generic-builtin':
  //       code = new Builtin;
  //       code.generic = true;
  //       break;

  //     case 'try':
  //       let block = new Try;
  //       this.requireTry(block);
  //       return block;

  //     default:
  //       throw new Bug;
  //   }

  //   this.requireBlock(code);
  //   return code;
  // }

  // /** Require try block */
  // requireTry(block: Try): void {
  //   while (true) {
  //     // check for another clause, preceded by optional clause name
  //     let endCursor = this.cursor;
  //     // optional newlines
  //     let nl = false;
  //     while (this.matchToken('\n')) {
  //       nl = true;
  //     }
  //     let nameToken = this.parseToken('name');
  //     if (nameToken && !this.parseToken('=')) {
  //       // not a named clause
  //       this.cursor = endCursor;
  //       return;
  //     }
  //     if (block.fields.length && !this.matchToken('else')) {
  //       // not another clause
  //       this.cursor = endCursor;
  //       return;
  //     }
  //     if (nl) {
  //       block.vertical = true;
  //     }

  //     if (nameToken && !nameToken.text.endsWith('?')) {
  //       throw this.setError('Clause name must end in ?', nameToken);
  //     }
  //     let name = nameToken ?
  //       // named clause
  //       new Name(nameToken.text, nameToken) :
  //       // anonymouse clause
  //       new Name(block.fields.length + 1, this.prevToken);

  //     // end clauses
  //     if (this.parseToken('ok', 'reject')) {
  //       let field = this.prevToken.type === 'ok' ? new OK : new Reject;
  //       block.add(field);
  //       field.name = name;
  //       field.value = null;
  //       return;
  //     }

  //     // parse a clause body
  //     let field = new Field;
  //     block.add(field);
  //     field.name = name;
  //     field.mode = 'formula';
  //     let clause = new Do;
  //     field.set(clause);

  //     this.requireBlock(clause);
  //     if (clause.vertical) block.vertical = true;

  //     continue;
  //   }
  //   // Maybe if try is vertical, set all clauses vertical too
  // }


  // requireValue(): Value {
  //   let value = this.parseLiteralMaybeFalsey();
  //   if (value !== undefined) return value;

  //   let path = this.parsePath();
  //   if (path) return path;

  //   throw this.setError('Expecting a value');
  // }

  /** Returns a Reference with tokens[] contains name tokens which may include a
   * leading ^/~ and trailing ?/!. May contain leading '.' token. Also contains
   * number tokens for testing. [] indexing will return a ReferenceFormula
   * instead. */
  parseReference(): Reference | undefined {
    let tokens: Token[] = [];
    while (true) {
      if (this.matchToken('.')) {
        if (!tokens.length) {
          // record leading dot
          tokens.push(this.prevToken);
        }
        this.requireToken('name', 'number');
        tokens.push(this.prevToken);
      } else if (this.peekToken('name')) {
        // allow '^' and '~' names to skip dot
        let prefix = this.cursorToken.text[0];
        if (prefix === '^' || prefix === '~') {
          tokens.push(this.cursorToken);
          this.cursor++;
          continue;
        }
        break;
      }
    }
    if (!tokens.length) return undefined;
    let ref = new Reference;
    ref.tokens = tokens;
    return ref;
  }

  /** Parse a literal value */
  parseLiteral(): Value | undefined {
    if (this.matchToken('number')) {
      let num = new Numeric;
      num.token = this.prevToken;
      num.value = Number(this.prevToken.text);
      assert(Number.isFinite(num.value));
      return num;
    }

    if (this.matchToken('_number_')) {
      let num = new Numeric;
      num.token = this.prevToken;
      num.value = NaN;
      return num;
    }

    if (this.matchToken('string')) {
      let text = new Text;
      text.token = this.prevToken;
      text.value = stringUnescape(this.prevToken.text.slice(1, -1));
      return text;
    }


    if (this.matchToken('nil')) {
      let nil = new Nil;
      nil.token = this.prevToken;
      return nil;
    }

    if (this.matchToken('anything')) {
      let any = new Anything;
      any.token = this.prevToken;
      return any;
    }

    if (this.matchToken('record')) {
      return this.requireBlock(new Record);
    }

    if (this.matchToken('choice')) {
      return this.requireBlock(new Choice);
    }

    // if (this.matchToken('table')) {
    //   let table = new Table;
    //   let template = new Row;
    //   table.rows.push(template);
    //   template.table = table;
    //   template.serial = 0;
    //   template.mode = 'formula';
    //   if (this.matchToken('of')) {
    //     let value = this.requireValue();
    //     if (isPath(value)) {
    //       // path is stored as metadata to be evaluated dynamically
    //       template.setMeta('^value', value);
    //     } else {
    //       // literal value is stored literally
    //       template.set(value);
    //     }
    //   } else {
    //     // Data block template
    //     let block = new Data;
    //     template.set(block);
    //     this.requireBlock(block);
    //   }
    //   return table;
    // }

    this.setError('Expecting a value');
    return undefined;
  }




  /** require one of several token types */
  requireToken(...types: TokenType[]): Token {
    let token = this.parseToken(...types);
    if (!token) {
      throw this.error;
    }
    return token;
  }


  /** parse one of several token types */
  parseToken(...types: TokenType[]): Token | undefined {
    if (this.matchToken(...types)) {
      return this.prevToken;
    }
    this.setError('Expecting ' + types.join(' or '));
    return undefined;
  }

  /** match one of several token types */
  matchToken(...types: TokenType[]) {
    if (this.peekToken(...types)) {
      this.cursor++;
      return true;
    }
    return false;
  }

  /** peek one of several token types */
  peekToken(...types: TokenType[]): boolean {
    let cursorType = this.cursorToken.type;
    for (let type of types) {
      if (type === cursorType) return true;
    }
    return false;
  }

}