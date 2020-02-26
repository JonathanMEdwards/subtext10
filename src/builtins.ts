import { Item, cast, Do, assert, Numeric, Character, Text, Dictionary, Value, Statement } from "./exports"

/** evaluate a builtin call. Assumes input fields present in containing block.
 * Arguments have already been type-checked and assigned */
export function evalBuiltin(statement: Statement, name: string) {
  let block = cast(statement.container, Do);
  // extract input values. Convert atomic values to JS values
  let inputs: builtinValue[] = (
    block.statements
      .filter(statement => statement.isInput)
      .map(input => {
        input.used = true;
        let value = input.value!;
        // extract JS values
        if (
          value instanceof Numeric
          || value instanceof Character
          || value instanceof Text
        ) {
          return value.value;
        }
        return value;
      })
  );
  assert(inputs.length > 0);

  // evaluate builtin function
  let result: builtinValue | undefined;
  statement.used = true;
  if (name.endsWith('?')) {

    // conditional
    let { accepted, value } = builtinConditionals[name](...inputs);
    statement.rejected = !accepted;
    if (statement.workspace.analyzing) {
      // analyze item as conditional
      statement.conditional = true;
      // return value unconditionally to define its type
      result = value;
    } else {
      // at runtime only set result if accepted
      result = accepted ? value : undefined;
    }
  } else {

    // unconditional
    result = builtins[name](...inputs);
  }

  // set result into item if defined
  statement.prune();
  if (result === undefined) {
  } else if (typeof result === 'number') {
    let value = new Numeric;
    value.value = result
    statement.setValue(value);
  } else if (typeof result === 'string') {
    let value = new Text;
    value.value = result
    statement.setValue(value);
  } else if (!result.containingItem) {
    // Use detached Value
    statement.setValue(result);
  } else {
    // copy attached value
    statement.setValue(result.copy(result.containingItem.path, statement.path));
  }
}

// builtins operate with JS strings and numbers, regular Value otherwise
type builtinValue = string | number | Value;

// dispatch table for unconditional builtins
let builtins: (
  Dictionary<(...args: any[]) => builtinValue>
) = {};

// dispatch table for conditional builtins
let builtinConditionals: (
  Dictionary<(...args: any[]) => { accepted: boolean, value: builtinValue}>
) = {};

/** definition of builtins */
export const builtinDefinitions = `
+ = do{in: 0; plus: 0; builtin +}
- = do{in: 0; subtrahend: 1; builtin -}
* = do{in: 0; multiplicand: 2; builtin *}
/ = do{in: 0; divisor: 2; builtin /}
round-down = do{in: 0; builtin round-down}
skip-white = do{in: ''; builtin skip-white}
>? = do{in: 0, with: 0, builtin >?}
>=? = do{in: 0, with: 0, builtin >=?}
<? = do{in: 0, with: 0, builtin <?}
<=? = do{in: 0, with: 0, builtin <=?}
=? = do{in: anything, to: in, builtin =?}
not=? = do{in: anything, to: in, builtin not=?}
`

builtins['+'] = (a: number, b: number) => a + b;
builtins['-'] = (a: number, b: number) => a - b;
builtins['*'] = (a: number, b: number) => a * b;
builtins['/'] = (a: number, b: number) => a / b;
builtins['round-down'] = (a: number) => Math.floor(a);
builtins['skip-white'] = (s: string) => s.trimStart();

builtinConditionals['>?'] = (a: number, b: number) => {
  return { accepted: a > b, value: b };
}
builtinConditionals['>=?'] = (a: number, b: number) => {
  return { accepted: a >= b, value: b };
}
builtinConditionals['<?'] = (a: number, b: number) => {
  return { accepted: a < b, value: b };
}
builtinConditionals['<=?'] = (a: number, b: number) => {
  return { accepted: a <= b, value: b };
}

builtinConditionals['=?'] = (a: builtinValue, b: builtinValue) => {
  // signature guarantees same types
  if (a instanceof Value) {
    assert(b instanceof Value);
    return {accepted: a.equals(b), value: b}
  }
  return { accepted: a === b, value: b };
}
builtinConditionals['not=?'] = (a: builtinValue, b: builtinValue) => {
  // signature guarantees same types
  if (a instanceof Value) {
    assert(b instanceof Value);
    return {accepted: !a.equals(b), value: b}
  }
  return { accepted: a !== b, value: b };
}

