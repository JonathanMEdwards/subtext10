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
  let result = builtins[name](...inputs);
  // set result into item
  item.prune();
  if (typeof result === 'number') {
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

// dispatch table for builtins
let builtins: Dictionary<(...args: any[]) => builtinValue> = {};

/** definition of builtins */
export const BuiltinDefinitions = `
+ = do{in: 0; plus: 0; builtin +}
- = do{in: 0; subtrahend: 1; builtin -}
* = do{in: 0; multiplicand: 2; builtin *}
/ = do{in: 0; divisor: 2; builtin /}
round-down = do{in: 0; builtin round-down}
skip-white = do{in: ''; builtin skip-white}
`

builtins['+'] = (a: number, b: number) => a + b;
builtins['-'] = (a: number, b: number) => a - b;
builtins['*'] = (a: number, b: number) => a * b;
builtins['/'] = (a: number, b: number) => a / b;
builtins['round-down'] = (a: number) => Math.floor(a);
builtins['skip-white'] = (s: string) => s.trimStart();
