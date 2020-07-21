import { arrayLast } from "./exports";
/** @module scanner
 * Lexical scanner. No regular expressions were harmed in this module.
 */

export type TokenType = (
  ':' | '=' | ':=' | '#' | '.' | ',' | ';' | '{' | '}' | '(' | ')'
  | '=|>' | 'update' | 'write' | '->'
  | '[' | ']' | '[]' | 'string' | 'number' | '_number_'
  | 'name' | 'end' | '\n'
  | 'call' | 'arg1' | 'arg2' | 'input'
  // keywords - add to matchToken switch statement
  | 'record' | 'choice' | 'table' | 'array' | 'do' | 'builtin' | 'anything'
  | 'nil' | 'try' | 'check' | 'not' | 'else' | 'reject' | 'let' | 'export'
  | 'that' | 'include' | 'with' | 'find?' | 'find!'
  | 'for-all' | 'for-all?' | 'for-all!' | 'for-none?' | 'query' | 'accumulate'
)

export class Token {
  constructor(
    readonly type: TokenType,
    readonly start: number,
    readonly end: number,
    readonly source: string)
  { }

  /** Copy an existing token giving a different type */
  static fake(type: TokenType, token: Token): Token {
    return new Token(type, token.start, token.end, token.source);
  }

  /** start of a character literal, including the single quote */
  static readonly characterLiteralStart = "character'";


  get text() { return this.toString() };

  toString() {
    return this.source.substring(this.start, this.end);
  }

  /** Hack to special case parsing of operator names */
  get isOperator(): boolean {
    if (this.type !== 'name') return false;
    if (this.text.startsWith('not=')) return true;
    switch (this.text[0]) {
      case '+':
      case '-':
      case '*':
      case '/':
      case '=':
      case '<':
      case '>':
      case '&':
        return true;

      default:
        return false;
    }
  }
}


/**
 * Tokenize source string into array of tokens.
 * @throws SyntaxError
 */
export function tokenize(source: string): Token[] {
  /** Scanning cursor index in source */
  let cursor = 0;

  let tokens: Token[] = [];

  while (cursor < source.length) {

    // comments skip to end of line or source
    // TODO: tokenize comments
    // if (match('//')) {
    //   for (let char = source.charCodeAt(cursor);
    //     cursor < source.length && !newline(char);
    //     cursor++) {}
    //   continue;
    // }

    let char = source.charCodeAt(cursor);

    // tokenize newlines
    if (newline(char)) {
      // ignore if first token or repeated
      if (tokens.length && arrayLast(tokens).type !== '\n') {
        tokens.push(new Token('\n', cursor - 1, cursor, source));
      }
      cursor++;
      continue;
    }

    // skip whitespace
    if (char <= 0x20) {
      cursor++;
      continue;
    }

    let start = cursor;
    let type = matchToken();
    tokens.push(new Token(type, start, cursor, source));
    continue;
  }

  if (!tokens.length) {
    throw new SyntaxError(source.length, source, 'Expecting something')
  }

  return tokens;

  /**
   * Matches token in `source` at `cursor`.
   * Returns a TokenType with `cursor` advanced
   * @throws SyntaxError
   */
  function matchToken(): TokenType {
    let start = cursor;

    // match single-quoted string and character literal
    if (match("'") || match(Token.characterLiteralStart)) {
      while (true) {
        // string must be terminated on same line
        if (atNewline()) {
          throw syntaxError("expecting '");
        }
        if (match("'")) return 'string';
        if (match('\\')) {
          // backslash escape
          // can't escape newline
          if (atNewline()) {
            throw syntaxError('expecting something after \\')
          }
          if (match('x')) {
            if (!matchHexDigit() || !matchHexDigit()) {
              throw syntaxError('expecting 2 hex digits after \\x')
            }
            continue;
          }
          if (match('u')) {
            if (
              !matchHexDigit()
              || !matchHexDigit()
              || !matchHexDigit()
              || !matchHexDigit()) {
              throw syntaxError('expecting 4 hex digits after \\u')
            }
            continue;
          }
        }
        cursor++;
        continue;
      }
    }

    // operators are names
    if (match('+')) return 'name';
    if (match('*')) return 'name';
    if (match('/')) return 'name';
    if (match('&')) return 'name';
    if (match('=?')) return 'name';
    if (match('>?')) return 'name';
    if (match('<?')) return 'name';
    if (match('>=?')) return 'name';
    if (match('<=?')) return 'name';
    if (match('not=?')) return 'name';
    if (match('=!')) return 'name';
    if (match('>!')) return 'name';
    if (match('<!')) return 'name';
    if (match('>=!')) return 'name';
    if (match('<=!')) return 'name';
    if (match('not=!')) return 'name';
    if (match('_number_')) return '_number_';

    // punctuation
    if (match('.')) return '.';
    if (match(',')) return ',';
    if (match(';')) return ';';
    if (match(':=')) return ':=';
    if (match('#')) return '#';
    if (match(':')) return ':';
    if (match('=|>')) return '=|>';
    if (match('=')) return '=';
    if (match('->')) return '->';
    if (match('{')) return '{';
    if (match('}')) return '}';
    if (match('(')) return '(';
    if (match(')')) return ')';
    if (match('[]')) return '[]';
    if (match('[')) return '[';
    if (match(']')) return ']';

    // match minus
    let minus = match('-');
    // match number
    if (matchNumber()) return 'number'
    // convert lone minus into name of subtraction operation
    if (minus) return 'name';

    // match name, optionally prefixed by metadata or importcharacter
    if (matchAlpha() || match('^') || match('~')) {
      while (true) {
        // allow internal hyphen, underscore, and ampersand
        if (match('-') || match('_') || match('&')) {
          while (match('-') || match('_') || match('&'));
          if (matchAlpha() || matchDigit()) continue;
          throw syntaxError('expecting alphanumeric character');
        }
        // allow trailing ?
        if (match('?')) {
          if (matchAlpha() || matchDigit() || match('-') || match('_')) {
            throw syntaxError('? can only be at end of name');
          }
          break;
        }
        // allow trailing !
        if (match('!')) {
          if (matchAlpha() || matchDigit() || match('-') || match('_')) {
            throw syntaxError('! can only be at end of name');
          }
          break;
        }
        if (!(matchAlpha() || matchDigit())) break;
        continue;
      }
      let name = source.substring(start, cursor);

      // override name with keywords, which equal their TokenType
      switch (name) {
        case 'record':
        case 'do':
        case 'with':
        case 'choice':
        case 'try':
        case 'check':
        case 'let':
        case 'export':
        case 'not':
        case 'else':
        case 'reject':
        case 'table':
        case 'array':
        case 'anything':
        case 'nil':
        case 'builtin':
        case 'that':
        case 'include':
        case 'find?':
        case 'find!':
        case 'for-all?':
        case 'for-all!':
        case 'for-all':
        case 'for-none?':
        case 'query':
        case 'accumulate':
        case 'update':
        case 'write':

          return name;
      }
      // name not a keyword
      return 'name';
    }


    throw syntaxError('not recognized')
  }

  /**
   * Matches unsigned number, advancing cursor
   * @throws SyntaxError
   */
  function matchNumber(): boolean {
    if (!matchDigit()) return false;
    while (matchDigit());
    // fraction
    if (match('.')) {
      if (!matchDigit()) {
        throw syntaxError('expecting fractional number');
      }
      while (matchDigit());
    }
    // exponent
    if (match('e') || match('E')) {
      // optional exponent sign
      match('+') || match('-');
      if (!matchDigit()) {
        throw syntaxError('expecting exponent');
      }
      while (matchDigit());
    }
    return true;
  }


  /**
   * Matches alphabetic character, advancing cursor
   */
  function matchAlpha(): boolean {
    let char = source.charCodeAt(cursor);
    if (
      (char >= 0x41 && char <= 0x5a)
      || (char >= 0x61 && char <= 0x7a)) {
      cursor++;
      return true;
    }
    return false;
  }

  /**
   * Matches numeric digit, advancing cursor
   */
  function matchDigit(): boolean {
    let char = source.charCodeAt(cursor);
    if (char >= 0x30 && char <= 0x39) {
      cursor++;
      return true;
    }
    return false;
  }

  /**
   * Matches hex digit, advancing cursor
   */
  function matchHexDigit(): boolean {
    let char = source.charCodeAt(cursor);
    if (
      (char >= 0x30 && char <= 0x39)
      || (char >= 0x41 && char <= 0x46)
      || (char >= 0x61 && char <= 0x66)) {
      cursor++;
      return true;
    }
    return false;
  }

  /**
   * Match a string in `source` at `cursor`.
   * On success advances `cursor` and returns true.
  */
  function match(s: string): boolean {
    for (let i = 0; i < s.length; i++) {
      if (s[i] !== source[cursor + i]) {
        return false;
      }
    }
    cursor += s.length;
    return true;
  }

  function syntaxError(message: string): SyntaxError {
    return new SyntaxError(cursor, source, message);
  }

  function atNewline() {
    return cursor >= source.length || newline(source.charCodeAt(cursor));
  }
}

function newline(char: number) {
  return char >= 0xa && char <= 0xd;
}

/** whether string is an operator */
export function isOperator(s: string) {
  switch (s[0]) {
    case '+':
    case '-':
    case '*':
    case '/':
    case '=':
    case '<':
    case '>':
      return true;
  }
  return s.startsWith('not=');
}

export class SyntaxError extends Error {
  constructor(readonly cursor: number, readonly source: string,
    readonly description = "unrecognized syntax") {
    super(
      description + ' [' + cursor + ']' + source.slice(cursor, cursor + 10)
    );
    this.name = 'SyntaxError';
  }
}
