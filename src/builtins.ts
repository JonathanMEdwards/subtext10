import { Item, cast, Do, assert, Numeric, Character, Text, Dictionary, Value } from "./exports"

/** evaluate a builtin call. Assumes input fields present in containing block.
 * Arguments have already been type-checked and assigned */
export function evalBuiltin(item: Item, name: string) {
  let block = cast(item.container, Do);
  // extract input values. Convert atomic values to JS values
  let inputs: builtinValue[] = (
    block.fields
      .filter(field => field.isInput)
      .map(field => {
        let value = field.value!;
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
  if (name.endsWith('?')) {

    // conditional
    let { accepted, value } = builtinConditionals[name](...inputs);
    item.rejected = !accepted;
    if (item.workspace.analyzing) {
      // analyze item as conditional
      item.conditional = true;
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
  item.prune();
  if (result === undefined) {
  } else if (typeof result === 'number') {
    let value = new Numeric;
    value.value = result
    item.setValue(value);
  } else if (typeof result === 'string') {
    let value = new Text;
    value.value = result
    item.setValue(value);
  } else {
    item.setValue(result);
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
export const BuiltinDefinitions = `
+ = do{in: 0; plus: 0; builtin +}
- = do{in: 0; subtrahend: 1; builtin -}
* = do{in: 0; multiplicand: 2; builtin *}
/ = do{in: 0; divisor: 2; builtin /}
round-down = do{in: 0; builtin round-down}
skip-white = do{in: ''; builtin skip-white}
=? = do{in: 0, with: 0, builtin =?}
not=? = do{in: 0, with: 0, builtin not=?}
>? = do{in: 0, with: 0, builtin >?}
>=? = do{in: 0, with: 0, builtin >=?}
<? = do{in: 0, with: 0, builtin <?}
<=? = do{in: 0, with: 0, builtin <=?}
`

builtins['+'] = (a: number, b: number) => a + b;
builtins['-'] = (a: number, b: number) => a - b;
builtins['*'] = (a: number, b: number) => a * b;
builtins['/'] = (a: number, b: number) => a / b;
builtins['round-down'] = (a: number) => Math.floor(a);
builtins['skip-white'] = (s: string) => s.trimStart();

builtinConditionals['=?'] = (a: number, b: number) => {
  return { accepted: a === b, value: b };
}
builtinConditionals['not=?'] = (a: number, b: number) => {
  return { accepted: a !== b, value: b };
}

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