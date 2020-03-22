import { Item, cast, Do, assert, Numeric, Character, Text, Dictionary, Value, Statement, arrayLast, Base, assertDefined, Nil, _Array } from "./exports"

/** evaluate a builtin call. Assumes input fields present in containing block.
 * Arguments have already been type-checked and assigned */
export function evalBuiltin(statement: Statement, name: string) {
  let block = cast(statement.container, Do);
  // extract input values. Convert atomic values to JS values
  let inputs: builtinValue[] = (
    block.statements
      .filter(statement => statement.isInput)
      .map(statement => {
        statement.used = true;
        let input = assertDefined(statement.value);
        // extract JS base values
        if (
          input instanceof Numeric
          || input instanceof Character
          || input instanceof Text
        ) {
          return input.value;
        }
        return input;
      })
  );
  assert(inputs.length > 0);
  // call builtin
  statement.used = true;
  builtins[name](statement, ...inputs);
}

/** builtins operate with JS string or number, regular Value otherwise */
export type builtinValue = string | number | Value;

/** dispatch table for builtins */
export const builtins: Dictionary<(statement: Statement, ...args: any[]) => void>
  = {};

/** definition of builtins */
export const builtinDefinitions = `
+ = do{in: 0; plus: 0; builtin +}
- = do{in: 0; subtrahend: 1; builtin -}
* = do{in: 0; multiplicand: 2; builtin *}
/ = do{in: 0; divisor: 2; builtin /}
truncate = do{in: 0; builtin truncate; export fraction = 0}
skip-white = do{in: ''; builtin skip-white}
>? = do{in: 0, than: 0, builtin >?}
>=? = do{in: 0, than: 0, builtin >=?}
<? = do{in: 0, than: 0, builtin <?}
<=? = do{in: 0, than: 0, builtin <=?}
=? = do{in: anything, to: in, builtin =?}
not=? = do{in: anything, to: in, builtin not=?}
`

builtins['+'] = (s: Statement, a: number, b: number) => {
  s.setFrom(a + b);
}
builtins['-'] = (s: Statement, a: number, b: number) => {
  s.setFrom(a - b);
};
builtins['*'] = (s: Statement, a: number, b: number) => {
  s.setFrom(a * b);
}
builtins['/'] = (s: Statement, a: number, b: number) => {
  s.setFrom(a / b);
}
builtins['truncate'] = (s: Statement, a: number) => {
  s.setFrom(Math.trunc(a));
  s.exportFrom(a - Math.trunc(a));
}
builtins['skip-white'] = (s: Statement, string: string) => {
  s.setFrom(string.trimStart());
}

builtins['>?'] = (s: Statement, a: number, b: number) => {
  s.setAccepted(a > b);
  s.setFrom(b);
}
builtins['>=?'] = (s: Statement, a: number, b: number) => {
  s.setAccepted(a >= b);
  s.setFrom(b);
}
builtins['<?'] = (s: Statement, a: number, b: number) => {
  s.setAccepted(a < b);
  s.setFrom(b);
}
builtins['<=?'] = (s: Statement, a: number, b: number) => {
  s.setAccepted(a <= b);
  s.setFrom(b);
}
builtins['=?'] = (s: Statement, a: builtinValue, b: builtinValue) => {
  // signature guarantees same types
  if (a instanceof Value) {
    assert(b instanceof Value);
    s.setAccepted(a.equals(b))
  } else {
    s.setAccepted(a === b);
  }
  s.setFrom(b);
}
builtins['not=?'] = (s: Statement, a: builtinValue, b: builtinValue) => {
  // signature guarantees same types
  if (a instanceof Value) {
    assert(b instanceof Value);
    s.setAccepted(!a.equals(b))
  } else {
    s.setAccepted(a !== b);
  }
  s.setFrom(b);
}
