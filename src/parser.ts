import { assert, Block, Choice, Code, Field, FieldID, Head, Numeric, stringUnescape, SyntaxError, Text, Token, tokenize, TokenType, Value, Nil, Anything, Record, Workspace, Reference, Do, trap, Call } from "./exports";

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

  space!: Workspace;

  /** require top-level Head definition */
  requireHead(head: Head) {
    // store Space in Parser
    this.space = head.workspace;

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

      if (this.peekToken('}', 'end')) {
        if (!block.fields.length) {
          throw this.setError('empty block', this.cursorToken)
        }
        return;
      }
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
        Token.mimic('=', this.cursorToken)
      );
      field.isInput = false;
    }

    // add field to block
    block.add(field);

    // parse formula
    this.requireFormula(field);

    return field;
  }

  /** Require a formula defining a field. Sets formulaType and metadata */
  requireFormula(field: Field): void {
    let startToken = this.cursorToken;
    // parse first term of formula
    if (!this.parseTerm(field, true)) {
      throw this.setError('expecting a formula')
    }
    // parse multiterm formula into a do-block
    let block: Do | undefined;
    while (!this.peekToken(',', ';', ')', '}', '\n', 'end')) {
      if (!block) {
        // move first term into multi-term do-block
        block = new Do;
        let first = new Field;
        first.id = this.space.newFieldID(undefined, startToken);
        if (field.metadata) {
          first.metadata = field.metadata;
          field.metadata = undefined;
          first.metadata.containingItem = first;
        }
        let value = field.value;
        if (value) {
          field.prune();
          first.setValue(value);
        }
        block.add(first);
        first.formulaType = field.formulaType;
        field.formulaType = 'code';
        field.setMeta('^code', block);
      }

      let term = new Field;
      term.id = this.space.newFieldID(undefined, this.cursorToken);
      block.add(term);
      if (!this.parseTerm(term, false)) {
        throw this.setError('expecting a formula')
      }
    }
  }

  /** parse a single term of a formula */
  parseTerm(field: Field, first = false): boolean {

    // literal value
    let literal = this.parseLiteral();
    if (literal) {
      if (field.isInput) {
        // literal input is stored as formula to allow reset
        field.formulaType = 'literal';
        field.setMeta('^literal', literal);
      } else {
        // literal output stored directly in value of field without a formula
        // to avoid infinite regress
        field.formulaType = 'none';
        field.value = literal;
        literal.containingItem = field;
      }
      return true;
    }

    // code block
    let code = this.parseCode();
    if (code) {
      field.formulaType = 'code';
      field.setMeta('^code', code);
      return true;
    }

    // reference
    let ref = this.parseReference();
    if (ref) {
      if (this.matchToken(':=')) {
        // change operation
        if (!ref.dependent) {
          throw this.setError('Change operation requires dependent path', ref.tokens[0]);
        }

        field.formulaType = 'change';
        field.setMeta('^lhs', ref);
        // parse formula into ^rhs
        let rhs = field.setMeta('^rhs', undefined);
        this.requireFormula(rhs);
        return true;
      }

      let call = this.parseCall(ref, first);
      if (call) {
        // call
        field.formulaType = 'call';
        field.setMeta('^call', call);
        return true;
      }

      // plain reference
      field.formulaType = 'reference';
      field.setMeta('^reference', ref);
      return true;
    }

    // include
    if (this.matchToken('include')) {
      field.formulaType = 'include';
      // ignore name for now - only include builtins
      this.requireToken('name');
      return true;
    }

    // builtin
    if (this.matchToken('builtin')) {
      let name = new Text;
      name.value = this.requireToken('name').text;
      field.formulaType = 'builtin';
      field.setMeta('^builtin', name);
      return true;
    }

    return false;

  }

  /** parse arguments following a reference. Param first rejects
   * syntax 'ref value x' and 'ref value('*/
  parseCall(ref: Reference, first = false): Call | undefined {

    // unparenthesized value following function reference
    let startCursor = this.cursor;
    let startToken = this.cursorToken;
    let rightValue = this.parseLiteral() || this.parseReference();
    if (
      rightValue
      && first
      && (
        this.parseReference()
        || this.parseLiteral()
        || this.parseToken('(')
      )
    ) {
      // reject ternary form at beginning of formula
      this.cursor = startCursor;
      return undefined;
    }
    if (!rightValue && !this.matchToken('(')) {
      return undefined;
    }
    if (ref.dependent) {
      // program references must be structureal
      throw this.setError('Program is dependent', ref.tokens[0]);
    }
    let call = new Call;

    // first field of call is reference to program
    ref.tokens.push(Token.mimic('call', this.prevToken));
    let prog = new Field;
    prog.id = this.space.newFieldID(undefined, this.prevToken);
    call.add(prog);
    prog.formulaType = 'reference';
    prog.setMeta('^reference', ref);

    // second field of call is input argument change operation
    let input = new Field;
    input.id = this.space.newFieldID(undefined, this.prevToken);
    call.add(input);
    input.formulaType = 'change';
    // LHS is dependent ref to first input
    let lhs = new Reference;
    lhs.tokens = [
      Token.mimic('that', this.prevToken),
      Token.mimic('arg1', this.prevToken)
    ]
    input.setMeta('^lhs', lhs);
    // RHS is structural reference to input value
    let rhsRef = new Reference;
    rhsRef.tokens = [Token.mimic('input', this.prevToken)]
    let rhs = input.setMeta('^rhs');
    rhs.formulaType = 'reference';
    rhs.setMeta('^reference', rhsRef);

    if (rightValue) {
      // unparenthesized value argument
      let arg = new Field;
      arg.formulaType = 'change';
      let lhs = new Reference;
      lhs.tokens = [
        Token.mimic('that', startToken),
        Token.mimic('arg2', startToken)
      ]
      arg.setMeta('^lhs', lhs);
      let rhs = arg.setMeta('^rhs');
      if (rightValue instanceof Reference) {
        rhs.formulaType = 'reference';
        rhs.setMeta('^reference', rightValue)
      } else {
        rhs.formulaType = 'none';
        rhs.setValue(rightValue);
      }
      arg.id = this.space.newFieldID(undefined, startToken);
      call.add(arg);
      return call;
    }

    // parse arguments into change operations
    while (!this.parseToken(')')) {
      let arg = new Field;
      let argToken = this.cursorToken;
      this.requireFormula(arg)
      if (arg.formulaType !== 'change') {
        // anonymous first argument
        if (call.fields.length !== 2) {
          throw this.setError('Only first argument can be anonymous', argToken);
        }
        // move formula to RHS of arg2 change operation
        let anon = arg;
        arg = new Field;
        arg.formulaType = 'change';
        let lhs = new Reference;
        lhs.tokens = [
          Token.mimic('that', argToken),
          Token.mimic('arg2', argToken)
        ]
        arg.setMeta('^lhs', lhs);
        let rhs = arg.setMeta('^rhs', anon.value);
        rhs.formulaType = anon.formulaType;
        if (anon.metadata) {
          rhs.metadata = anon.metadata;
          rhs.metadata.containingItem = rhs;
        }
      }

      arg.id = this.space.newFieldID(undefined, argToken);
      call.add(arg);
      this.matchToken(',');
    }

    return call;
  }

  /** parse a code block */
  parseCode(): Code | undefined {
    let token = this.parseToken('do', 'try');
    if (!token) return undefined;
    let code: Code;
    switch (token.type) {
      case 'do':
        code = new Do;
        break;

      // case 'builtin':
      //   code = new Builtin;
      //   break;

      // case 'try':
      //   let block = new Try;
      //   this.requireTry(block);
      //   return block;

      default:
        trap();
    }

    // parse body of block
    this.requireBlock(code);
    return code;
  }

  /** Returns a Reference with tokens[] containing name tokens which may include
   * a leading ^ and trailing ?/!. Will contain leading 'that' for dependent
   * path. Also contains '~' tokens for extra results. Also contains number
   * tokens for testing. [] indexing will return a ReferenceFormula instead. */
  parseReference(): Reference | undefined {
    let tokens: Token[] = [];

    // leading name or that
    if (this.matchToken('name', 'that')) {
      if (this.prevToken.text[0] === '^') {
        throw this.setError("Reference can't start with ^", this.cursorToken);
      }

      tokens.push(this.prevToken);
    } else if (this.peekToken('.', '~')) {
      // leading . or ~ simulates leading 'that'
      tokens.push(Token.mimic('that', this.cursorToken));
    }

    // rest of path
    while (true) {
      if (this.matchToken('.')) {
        this.requireToken('name', 'number');
        if (this.prevToken.text[0] === '^') {
          throw this.setError("^ can't follow .", this.prevToken)
        }
        tokens.push(this.prevToken);
        continue;
      } else if (this.peekToken('name') && this.cursorToken.text[0] === '^') {
        // metadata
        tokens.push(this.cursorToken);
        this.cursor++;
        continue;
      } else if (this.matchToken('~')) {
        tokens.push(this.prevToken);
        if (this.peekToken('~')) {
          throw this.setError("repeated ~", this.cursorToken);
        }
        if (this.peekToken('name')) {
          // extra result name without separating dot
          tokens.push(this.prevToken);
        }
        continue;
      }
      break;
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

}