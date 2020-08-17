/**
 * @module
 *
 * Utility functions
 */


/** Type of dynamic object */
export interface Dictionary<T> {
  [key: string]: T;
}

/** type guard argument as an object, not a primitive value */
export function isObject(x: any): x is object {
  return x !== null && typeof x === 'object';
}

export function isString(x: any): x is string {
  return typeof x === 'string';
}

export function isNumber(x: any): x is number {
  return typeof x === 'number';
}

/** Returns a new instance of an object. Calls constructor with no args */
export function another<T extends Object>(existing: T): T {
  return new (existing.constructor as new () => T);
}

/**
 * Safe class cast, thanks to Ryan Cavanaugh and Duan Yo
 * Throws exception on failure.
 */
export function cast<T>(instance: any, ctor: { new(...args: any[]): T }): T {
  if (instance instanceof ctor) return instance;
  trap('class cast exception');
}


/** trap if value undefined, returns value otherwise */
export function assertDefined<T>(x: T): Exclude<T, undefined> {
  assert(x !== undefined);
  return x as Exclude<T, undefined>;
}


/** Assertion checking */
export function assert(condition: any, message = 'failed assertion'):
  asserts condition {
  if (!condition) {
    trap(message);
  }
}

/** trap */
export function trap(message = 'internal error'): never {
  debugger;
  throw new Trap(message);
}

/** Trap exception */
class Trap extends Error {
  constructor(message = 'internal error') {
    super(message);
    this.name = 'Trap';
  }
}


// Array utils

/** return last element of array else trap */
export function arrayLast<T>(array: ReadonlyArray<T>): T {
  if (array.length === 0) trap();
  return array[array.length - 1];
}

// /** allow negative indices from end. -1 is last element */
// export function arrayBack<T>(array: T[], index: number): T {
//   if (index >= 0 || array.length < - index) trap();
//   return array[array.length + index];
// }

/** remove first occurence of a value in an array */
export function arrayRemove<T>(array: T[], value: T) {
  let i = array.indexOf(value);
  assert(i >= 0);
  array.splice(i, 1);
}

/** update first occurence of a value in an array */
export function arrayReplace<T>(array: T[], value: T, replacement: T) {
  let i = array.indexOf(value);
  assert(i >= 0);
  array.splice(i, 1, replacement);
}

/** returns a reversed copy of an array */
export function arrayReverse<T>(array: T[]): T[] {
  return array.slice().reverse();
}

export function arrayEquals<T>(xs: T[], ys: T[]) {
  return (xs.length === ys.length && xs.every((x, i) => x === ys[i]));
}

// String utils

/** convert args into strings and concatenate them, skipping falsey values.
 * Useful for args of the form `test && string` */
export function concatIf(...args: any[]): string {
  let result = '';
  args.forEach(arg => {
    if (arg) result += arg;
  });
  return result;
}

/*
String escaping code copied from
https://github.com/harc/ohm/blob/master/src/common.js
*/

/** convert string escape sequences */
export function stringUnescape(input: string): string {
  let output = '';
  for (let i = 0; i < input.length; i++) {
    let c = input[i];
    if (c === '\\') {
      c = input[++i];
      switch (c) {
        case 'b':
          c = '\b';
          break;
        case 'f':
          c = '\f';
          break;
        case 'n':
          c = '\n';
          break;
        case 'r':
          c = '\r';
          break;
        case 't':
          c = '\t';
          break;
        case 'x':
          c = String.fromCharCode(
            parseInt(input.substring(i + 1, i + 3), 16));
          i += 2;
          break;
        case 'u':
          c = String.fromCharCode(
            parseInt(input.substring(i + 1, i + 5), 16));
          i += 4;
          break;
      }
    }
    output += c;
  }
  return output;
}

/**
 * Returns single-quoted escaped string
 */
export function escapedString(s: string): string {
  let out = "'";
  for (let c of s) {
    out += charEscape(c, "'");
  }
  return out + "'";
}
/**
 * Returns escaped representation of character c.
 * If delim is specified only that kind of quote will be escaped.
 * Copied from ohm/src/common.js
 */
function charEscape(c: string, delim?: string) {
  let charCode = c.charCodeAt(0);
  if ((c === '"' || c === "'") && delim && c !== delim) {
    return c;
  } else if (charCode < 128) {
    return escapeStringFor[charCode];
  } else if (128 <= charCode && charCode < 256) {
    return '\\x' + pad(charCode.toString(16), 2);
  } else {
    return '\\u' + pad(charCode.toString(16), 4);
  }
}

function pad(numberAsString: string, len: number): string {
  let zeros: string[] = [];
  for (let idx = 0; idx < numberAsString.length - len; idx++) {
    zeros.push('0');
  }
  return zeros.join('') + numberAsString;
}

const escapeStringFor: { [index: number]: string } = {};
for (let c = 0; c < 128; c++) {
  escapeStringFor[c] = String.fromCharCode(c);
}
escapeStringFor["'".charCodeAt(0)] = "\\'";
escapeStringFor['"'.charCodeAt(0)] = '\\"';
escapeStringFor['\\'.charCodeAt(0)] = '\\\\';
escapeStringFor['\b'.charCodeAt(0)] = '\\b';
escapeStringFor['\f'.charCodeAt(0)] = '\\f';
escapeStringFor['\n'.charCodeAt(0)] = '\\n';
escapeStringFor['\r'.charCodeAt(0)] = '\\r';
escapeStringFor['\t'.charCodeAt(0)] = '\\t';