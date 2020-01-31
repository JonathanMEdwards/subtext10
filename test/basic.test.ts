import { Doc } from "../src/exports";
/** @module
 *
 * Basic tests
 */

/** Compile and dump to plain JS object */
function expectDump(source: string) {
  return expect(Doc.compile(source).dump());
}

/** Test compiler exceptions */
function expectCompiling(source: string) {
  return expect(() => Doc.compile(source));
}


test('literal outputs', () => {
  expectDump("a = 0, b = '', c = nil, d = record{x = 0, y: 1}")
    .toEqual({ a: 0, b: '', c: null, d: { x: 0, y: 1} });
});

test('literal inputs', () => {
  expectDump("a: 0, b: '', c: nil, d: record{x = 0, y: 1}")
    .toEqual({ a: 0, b: '', c: null, d: { x: 0, y: 1 }  });
});

// test('references', () => {
//   expectDump("a: b, b: 0")
//     .toEqual({a: 0, b: 0});
//   expectDump("a: b, b: data{x: 0, y: 1}")
//     .toEqual({a: {x: 0, y: 1}, b: {x: 0, y: 1}});
// });

// test('path translation', () => {
//   let d = Root.compile("a: b, b: data{x: 0, y: x}")
//   expect(d.toJS())
//     .toEqual({ a: { x: 0, y: 0 }, b: { x: 0, y: 0 } });
//   expect(d.pathToJS('a.y.^value')).toEqual('a.x')
// });

// test('undefined reference', () => {
//   expectCompiling("a: c, b: 0")
//     .toThrow('Name not defined in context: c');
//   expectCompiling("a: b.c, b: data{x: 0}")
//     .toThrow('Name not defined: c');
// });

// test('invalid recursion', () => {
//   expectCompiling("a: a")
//     .toThrow('Self reference: a');
//   expectCompiling("a: data{x: a}")
//     .toThrow('Illegal recursive reference');
// });

// test('cyclic references', () => {
//   expectCompiling("a: b, b: a")
//     .toThrow('Illegal cyclic reference');
// });

// test('set literal value', () => {
//   expectDump("a = 0 do{:= ''}")
//     .toEqual({ a: ''});
// });

// test('set block value', () => {
//   expectDump("a = data{x: 0, y = x}, b = a do{:= a}")
//     .toEqual({ a: { x: 0, y: 0 }, b: { x: 0, y: 0} });
//   expectDump("a = data{x: 0, y = x}, b = a do{x := 1}")
//     .toEqual({ a: { x: 0, y: 0 }, b: { x: 1, y: 1} });
//   expectCompiling("a = data{x: 0, y = x}, b = a do{x := ''}")
//     .toThrow('Type mismatch');
//   expectCompiling("a = data{x: 0, y = x}, b = a do{y := ''}")
//     .toThrow('Cannot set a formula');
// });

// test('$ ref', () => {
//   expectDump("a = data{x: 0, y = x}, b = a do{:= $.x}")
//     .toEqual({ a: { x: 0, y: 0 }, b: 0 });
// });

// test('default expression value', () => {
//   expectDump("a = 0 do{:= do{:= 1}}")
//     .toEqual({ a: 1 });
// });

// test('function call', () => {
//   expectDump("f = 0 do{:= $}, a = 1 f(), b = 2 a()")
//     .toEqual({ f: 0, a: 1, b: 2 });
//   expectCompiling("f = 0 do{:= $}, a = '' f()")
//     .toThrow('Type mismatch');
//   expectDump("f() = 0 do{:= $}, a = 1 f(), b = 2 a()")
//     .toEqual({ f: 0, a: 1, b: 2 });
//   expectCompiling("f() = 0 do{:= $}, a = f")
//     .toThrow('Accessing a function as a value');
// });

// test('arguments', () => {
//   expectDump("f = 0 do{arg: 1, := arg}, a = 0 f()")
//     .toEqual({ f: 1, a: 1});
//   expectDump("f = 0 do{arg: 1, := arg}, a = 0 f 2")
//     .toEqual({ f: 1, a: 2});
//   expectDump("f = 0 do{arg: 1, := arg}, a = 0 f(2)")
//     .toEqual({ f: 1, a: 2});
//   expectDump("f = 0 do{arg: 1, := arg}, a = 0 f(arg:=2)")
//     .toEqual({ f: 1, a: 2 });
//   expectCompiling("f = 0 do{arg: 1, := arg}, a = 0 f ''")
//     .toThrow('Type mismatch');
//   expectCompiling("f = 0 do{arg: 1, := arg}, a = 0 f(2, 3)")
//     .toThrow('Unexpected argument');
//   expectCompiling("f = 0 do{arg: 1, := arg}, a = 0 f(2, 3)")
//     .toThrow('Unexpected argument');
//   expectCompiling("f = 0 do{arg: 1, := arg}, a = 0 f(foo:=2)")
//     .toThrow('Name not defined');
//   expectCompiling("f = 0 do{arg: 1, := arg}, a = 0 f(foo:=2, 3)")
//     .toThrow('Expecting argument name');
// });

// test('arithmetic', () => {
//   expectDump("a = 1 + 2")
//     .toEqual({ a: 3 });
//   expectDump("a = 1 +(2)")
//     .toEqual({ a: 3 });
//   expectCompiling("a = '' + 0")
//       .toThrow('Type mismatch');
//   expectCompiling("a = 1 + ''")
//     .toThrow('Type mismatch');
//   expectDump("a = 1 + 2 * 3")
//     .toEqual({ a: 9 });
//   expectDump("a = 1 + (2 * 3)")
//     .toEqual({ a: 7 });
// });

// test('default subject', () => {
//   expectDump("fnc = 1 do{a: 1, b: 1, := + a, := + b}")
//     .toEqual({ fnc: 3 });
//   expectDump("fnc = 1 do{a: 1, b: 1, := $ + a + b}")
//     .toEqual({ fnc: 3 });
//   expectDump("fnc = 1 do{a: 1, b: 1, := + a + b}")
//     .toEqual({ fnc: 3 });
//   expectDump("fnc = 1 do{a: 1, b: 1, := + (a + b)}")
//     .toEqual({ fnc: 3 });
// });

// test('generics', () => {
//   expectCompiling("a? = 1 =? 2")
//     .not.toThrow();
//   expectCompiling("a? = 1 =? ''")
//     .toThrow('Type mismatch');
// });

// test('conditional functions', () => {
//   expectDump("a? = 1 =? 2")
//     .toEqual({ 'a?': null });
//   expectDump("a? = 2 =? 2")
//     .toEqual({ 'a?': 2 });
//   expectCompiling("a = 1 =? 2")
//     .toThrow('must end in ?');
//   expectCompiling("a: 1 =? 2")
//     .toThrow('States can not be conditional');
//   expectCompiling("a? = 1 + 2")
//     .toThrow('Name ending in ? must be conditional');
//   expectCompiling("a? = 1")
//     .toThrow('Name ending in ? must be conditional');
//   });

//   test('! assertion', () => {
//     expectDump("a? = 1 =? 1, b = a!")
//       .toEqual({ 'a?': 1, b: 1 });
//     expectCompiling("a? = 1 =? 2, b = a!")
//       .toThrow('Access via a! rejected');
//     expectCompiling("f? = 0 do{b = a, a = check 1 =? 2}")
//       .toThrow('Access via a rejected');
//     expectDump("a = 1 =! 1")
//       .toEqual({ a: 1 });
//     expectCompiling("a = 1 =! 2")
//       .toThrow('Asserted call rejected');
//   });

// test('choices', () => {
//   expectDump("a: choice{x?: 1, y?: ''}")
//     .toEqual({ a: { "x?": 1 } });
//   expectCompiling("a: choice{x: 1, y?: ''}")
//     .toThrow('Choices must end in ?');
//   expectDump("a = choice{x?: 1, y?: ''} do{y? := 'foo'}")
//     .toEqual({ a: { "y?": 'foo' } });
//   expectDump("a = choice{x?: 1, y?: ''}, b? = a.x?")
//     .toEqual({ a: { "x?": 1 }, "b?": 1});
//   expectDump("a = choice{x?: 1, y?: ''}, b? = a.y?")
//     .toEqual({ a: { "x?": 1 }, "b?": null});
//   expectCompiling("a = choice{x?: 1, y?: ''}, b = a.y?")
//     .toThrow('must end in ?');
//   expectCompiling("a = choice{x?: 0, y?: 1} do{x? := + 1}")
//     .toThrow('must end in ?');
//   expectDump("a? = choice{x?: 0, y?: 1} do{x? := + 1}")
//     .toEqual({ "a?": { "x?": 1 } });
//   expectDump("a? = choice{x?: 0, y?: 1} do{y? := + 1}")
//     .toEqual({ "a?": null });
// })

// test('conditional blocks', () => {
//   expectDump("a: 0 try{check =? 0, := 1} else{:= + $} else ok")
//   .toEqual({ a: 1 });
//   expectDump("a = 0 try{check =? 0, := 1} else{:= + $}")
//   .toEqual({ a: 1 });
//   expectDump("a = 0 try{check =? 0, := 1} else{:= + $} else ok")
//   .toEqual({ a: 1 });
//   expectDump("a = 2 try{check =? 0, := 1} else{:= + $} else ok")
//     .toEqual({ a: 4 });
//   expectDump(
//     "a? = 2 try{check =? 0, := 1} else {check =? 2, := + $} else reject")
//     .toEqual({ 'a?': 4 });
//   expectDump(
//     "a? = 1 try{check =? 0, := 1} else {check =? 2, := + $} else reject")
//     .toEqual({ 'a?': null });
//   expectDump("a? = 0 do{ not =? 0}")
//     .toEqual({ 'a?': null });
//   expectCompiling("a? = 0 do{ check 0}")
//     .toThrow('check must be conditional');
//   expectCompiling("a? = 0 do{ check 0 + 1}")
//     .toThrow('check must be conditional');
//   expectCompiling("a = 1 try{check =? 0, := 1} else{check =? 2, := + $}")
//     .toThrow('Try failed');
//   expectCompiling("a = 0 try{check =? 0, := 1} else {:= 'foo'}")
//     .toThrow('Type mismatch');
//   expectCompiling("a = 0 try{check =? 0, := 'foo'} else ok")
//     .toThrow('Type mismatch');
// });

// test('recursive choices', () => {
//   expectCompiling("a: choice{x?: a, y?: 1}")
//     .toThrow('Illegal recursive reference');
//   expectDump("a: choice{x?: 1, y?: a}")
//     .toEqual({ a: { "x?": 1 } });
//   expectDump("a: choice{x?: 1, y?: a}, b = a do{y? := $}")
//     .toEqual({ a: { "x?": 1 }, b: { "y?": { "x?": 1 }} });
//   expectDump("a: choice{x?: 1, y?: b}, b: choice{x?: 1, y?: a}")
//     .toEqual({ a: { "x?": 1 }, b: { "x?": 1 } });
//   expectCompiling("a: choice{x?: b, y?: 1}, b: choice{x?: a, y?: 1}")
//     .toThrow('Illegal cyclic reference');
// });

// test('recursive functions', () => {
//   expectDump("fac = 0 try{check =? 0, := 1} else{:= $ - 1 fac() * $}")
//     .toEqual({ fac: 1 });
//   expectDump("fac = 4 try{check =? 0, := 1} else{:= $ - 1 fac() * $}")
//     .toEqual({ fac: 24 });
//   expectCompiling("fac = -1 try{check =? 0, := 1} else{:= $ - 1 fac() * $}")
//     .toThrow('depth limit');
//   // mutual recursion
//   expectDump(`
//     even? = 3 try{check =? 0} else{check - 1 odd?()} else reject,
//     odd? = 0 do{not =? 0, check - 1 even?()}
//     `).toEqual({"even?": null, "odd?": null});
//   expectDump(`
//     even? = 4 try{check =? 0} else{check - 1 odd?()} else reject,
//     odd? = 0 do{not =? 0, check - 1 even?()}
//     `).toEqual({ "even?": 4, "odd?": null });
// });

// test('formula access', () => {
//   expectDump("a = 0 do{foo = 1}, b = a~foo")
//     .toEqual({ a: 0, b: 1 });
//   expectDump("a = 0 do{foo = 2}, b = 1 a(), c = b~foo")
//     .toEqual({ a: 0, b: 1, c: 2 });
//   expectDump("a = 0 do{foo = 1}, b = a~, c = b.foo")
//     .toEqual({ a: 0, b: {foo: 1}, c: 1 });
//   expectCompiling("a: 0 do{foo = 1}, b = a~foo")
//     .toThrow('Undefined formula access');
//   // set command
//   expectDump("a = 0 do{foo = := $ + 1}, b = a~foo")
//     .toEqual({ a: 1, b: 1 });
//   expectDump("a = 0 do{foo = := $ + 1}, b = a~, c = b.foo")
//     .toEqual({ a: 1, b: {foo: 1} , c: 1 });
//   // conditional
//   expectDump(
//     "a = 0 try zero?={check =? 0} non-zero? = else ok, b? = a~zero?")
//     .toEqual({ a: 0, "b?": { "1": 0 } });
//   expectDump(
//     "a = 0 try zero?={check =? 0} non-zero?= else ok, b? = a~non-zero?")
//     .toEqual({ a: 0, "b?": null });
//   expectDump(`
//     a = 0 try zero?={check =? 0} non-zero?= else ok
//     b = a~
//     c? = b.non-zero?
//     `).toEqual({ a: 0, b: { "zero?": { "1": 0 }, "non-zero?": null }, "c?": null });
//   expectDump("a = 0 do{foo = 1}, b = 0 a()~")
//     .toEqual({ a: 0, b: {foo: 1} });

// });


// test('modification', () => {
//   let doc = Root.compile("a: 0, b = 'foo'");
//   doc.modify('a', 1);
//   expect(doc.toJS()).toEqual({ a: 1, b: 'foo' });
//   expect(() => { doc.modify('a', 'foo') }).toThrow('Type mismatch');
//   expect(() => { doc.modify('b', 'foo') }).toThrow('cannot be modified');
// });
