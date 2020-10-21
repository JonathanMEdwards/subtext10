import { Item, cast, Do, assert, _Number, Character, Text, Dictionary, Value, Statement, arrayLast, Base, assertDefined, Nil, _Array, StaticError, Metafield, Choice, Anything} from "./exports"

// extract input values. Converts a _Number to number
function inputs(statement: Statement): builtinValue[] {
  let block = cast(statement.container, Do);
  let inputs: builtinValue[] = (
    block.statements
      .filter(statement => statement.io === 'input')
      .map(statement => {
        statement.used = true;
        let input = assertDefined(statement.value);
        // convert _Number to number
        if (input instanceof _Number) {
          return input.value;
        }
        return input;
      })
  );
  assert(inputs.length > 0);
  return inputs;
}

/** evaluate a builtin call. Assumes input fields present in containing block.
 * Arguments have already been type-checked and assigned */
export function evalBuiltin(statement: Statement) {

  statement.used = true;
  let name = cast(statement.get('^builtin').value, Text).value;
  builtins[name](statement, ...inputs(statement));
}

/** update a builtin call, returning result ^change  */
export function updateBuiltin(statement: Statement, change: Item): Metafield {

  // get update function
  let name = cast(statement.get('^builtin').value, Text).value;
  let update = builtinUpdates[name];
  if (!update) {
    throw new StaticError(statement, `Builtin %{name} not updatable`)
  }

  // write to ^delta of first input parameter
  let input = statement.container.items[0];
  assert(input.io === 'input');
  let write = input.setDelta(undefined);

  // append changed result to input values
  let values = inputs(statement);
  let delta = assertDefined(change.value);
  values.push(
    delta instanceof _Number ? delta.value : delta
  );

  // call update function
  update(write, ...values);
  assert(write.value);

  return write;
}

/** builtins operate with JS number or Value */
export type builtinValue = number | Value;

/** dispatch table for builtins */
export const builtins: Dictionary<(statement: Statement, ...args: any[]) => void>
  = {};

/** dispatch table for builtin updates. write is the ^delta to set. args are the
 * input argument values followed by the update value */
export const builtinUpdates: Dictionary<(write: Metafield, ...args: any[]) => void>
  = {};

/** definition of builtins */
export const builtinDefinitions = `
+ = updatable{in: 0; plus: 0; builtin +}
- = updatable{in: 0; subtrahend: 1; builtin -}
* = updatable{in: 0; multiplicand: 2; builtin *}
/ = updatable{in: 0; divisor: 2; builtin /}
truncate = do{in: 0; builtin truncate; export fraction = 0}
>? = do{in: 0, than: 0, builtin >?}
>=? = do{in: 0, than: 0, builtin >=?}
<? = do{in: 0, than: 0, builtin <?}
<=? = do{in: 0, than: 0, builtin <=?}
=? = do{in: anything, to: in, builtin =?}
not=? = do{in: anything, to: in, builtin not=?}
no = choice{no?: nil, yes?: nil}
yes = no #yes()
off = choice{off?: nil, on?: nil}
on = off #on()
flip = do{in: anything, builtin flip}
`

builtins['+'] = (s: Statement, a: number, b: number) => {
  s.setFrom(a + b);
}
builtinUpdates['+'] = (write: Item, a: number, b: number, change: number) => {
  write.setFrom(change - b);
}

builtins['-'] = (s: Statement, a: number, b: number) => {
  s.setFrom(a - b);
};
builtinUpdates['-'] = (write: Item, a: number, b: number, change: number) => {
  write.setFrom(change + b);
}

builtins['*'] = (s: Statement, a: number, b: number) => {
  s.setFrom(a * b);
}
builtinUpdates['*'] = (write: Item, a: number, b: number, change: number) => {
  write.setFrom(change / b);
}

builtins['/'] = (s: Statement, a: number, b: number) => {
  s.setFrom(a / b);
}
builtinUpdates['/'] = (write: Item, a: number, b: number, change: number) => {
  write.setFrom(change * b);
}

builtins['truncate'] = (s: Statement, a: number) => {
  s.setFrom(Math.trunc(a));
  s.exportFrom(a - Math.trunc(a));
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

// TODO: Flip any binary choice. Needs a generic choice argument
builtins['flip'] = (s: Statement, a: Value) => {
  s.setFrom(a);
  if (a instanceof Anything) return;
  if (!(a instanceof Choice) || a.fields.length !== 2) {
    throw new StaticError(a.token, 'Flip requires a binary choice' )
  }
  let choice = cast(s.value, Choice);
  choice.setChoice(choice.choiceIndex? 0 : 1)
}
