import { Item, cast, Do, assert, Numeric, Character, Text, Dictionary, Value, Statement, arrayLast, Base, assertDefined, Nil } from "./exports"

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

  // evaluate builtin function
  let result: builtinValue | undefined;
  let exporting: builtinValue | undefined;
  statement.used = true;
  if (name.endsWith('?')) {

    // conditional
    let { accepted, value, export: exportValue } =
      builtinConditionals[name](...inputs);
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
    exporting = exportValue;
  } else {

    // unconditional
    ({ value: result, export: exporting } = builtins[name](...inputs));
  }

  // set result into item if define
  if (result !== undefined) {
    statement.setFrom(result)
  }

  // set export value
  if (exporting !== undefined) {
    let exportStatement = arrayLast(block.statements);
    assert(exportStatement.dataflow === 'export');
    exportStatement.detachValue();
    exportStatement.setFrom(exporting)
  }
}

/** builtins operate with JS string or number, regular Value otherwise */
type builtinValue = string | number | Value;

/** dispatch table for unconditional builtins. returns object containing value
 * and export */
let builtins: (
  Dictionary<(...args: any[]) =>
    { value: builtinValue, export?: builtinValue }>
) = {};

/** dispatch table for conditional builtins. returns object containing
 * acceptance, value, and export */
let builtinConditionals: (
  Dictionary<(...args: any[]) =>
    { accepted: boolean, value: builtinValue, export?: builtinValue  }>
) = {};

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

builtins['+'] = (a: number, b: number) => ({ value: a + b });
builtins['-'] = (a: number, b: number) => ({ value: a - b });
builtins['*'] = (a: number, b: number) => ({ value: a * b });
builtins['/'] = (a: number, b: number) => ({ value: a / b });
builtins['truncate'] = (a: number) =>
  ({ value: Math.trunc(a), export: a - Math.trunc(a) });
builtins['skip-white'] = (s: string) => ({ value: s.trimStart() });

builtinConditionals['>?'] = (a: number, b: number) =>
  ({ accepted: a > b, value: b });

builtinConditionals['>=?'] = (a: number, b: number) =>
  ({ accepted: a >= b, value: b });

builtinConditionals['<?'] = (a: number, b: number) =>
  ({ accepted: a < b, value: b });

builtinConditionals['<=?'] = (a: number, b: number) =>
  ({ accepted: a <= b, value: b });

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

