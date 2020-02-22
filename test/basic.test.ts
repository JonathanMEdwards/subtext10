import { Workspace } from "../src/exports";
/** @module
 *
 * Basic tests
 */

/** Compile and dump at a location to plain JS object */
function expectDump(source: string, at = '') {
  return expect(Workspace.compile(source).dumpAt(at));
}

/** Test compiler exceptions */
function expectCompiling(source: string) {
  return expect(() => Workspace.compile(source));
}


test('literal outputs', () => {
  expectDump("a = 0, b = '', c = nil, d = record{x = 0, y: 1}")
    .toEqual({ a: 0, b: '', c: null, d: { x: 0, y: 1} });
});

test('literal inputs', () => {
  expectDump("a: 0, b: '', c: nil, d: record{x = 0, y: 1}")
    .toEqual({ a: 0, b: '', c: null, d: { x: 0, y: 1 }  });
});

test('references', () => {
  expectDump("a: 0, b: a")
    .toEqual({a: 0, b: 0});
  expectDump("a: b, b: 0")
    .toEqual({a: 0, b: 0});
  expectDump("a: b, b: record{x: 0, y: 1}")
    .toEqual({a: {x: 0, y: 1}, b: {x: 0, y: 1}});
});

test('path translation', () => {
  expectDump("a: b, b: record {x: 0, y: x}")
    .toEqual({ a: { x: 0, y: 0 }, b: { x: 0, y: 0 } });
  expectDump("a: b, b: record {x: 0, y: x}", 'a.y.^reference')
    .toEqual('a.x')
  expectDump("a: b, b: record {x: 0, y: c}, c: 0", 'a.y.^reference')
    .toEqual('c')
});

test('undefined name', () => {
  expectCompiling("a: c, b: 0")
    .toThrow('Undefined name: c');
  expectCompiling("a: b.c, b: record {x: 0}")
    .toThrow('Undefined name: c');
});

test('circular references', () => {
  expectCompiling("a: a")
    .toThrow('Circular reference: a');
  expectCompiling("a: record{x: a}")
    .toThrow('Circular reference: a');
  expectCompiling("a: b, b: a")
    .toThrow('Circular reference: a');
});

test('do block', () => {
  expectDump("a = do{1}")
    .toEqual({ a: 1 });
  expectDump("a = do{1; 2}")
    .toEqual({ a: 2 });
  expectDump("a = do{1; that}")
    .toEqual({ a: 1 });
  expectDump("a = do{record{x: 0}; .x}")
    .toEqual({ a: 0 });
  expectDump("a = 0; b = that")
    .toEqual({ a: 0, b: 0 });
  expectDump("a = 0; b = do{that}")
    .toEqual({ a: 0, b: 0 });
});

test('change', () => {
  expectDump("a = record{x: 0, y : 0}, b = .x := 1")
    .toEqual({ a: {x: 0, y: 0}, b: {x: 1, y: 0}});
  expectCompiling("a = record{x = 0, y : 0}, b = .x := 1")
    .toThrow('changing an output');
  expectCompiling("a = record{x: 0, y : 0}, b = .x := 'foo'")
    .toThrow('changing type');
  expectDump("a = record{x: 0, y : record{i: 0, j: 0}}, b = .y := do{.i := 1}")
    .toEqual({ a: { x: 0, y: { i: 0, j: 0 } }, b: { x: 0, y: {i: 1, j: 0}}});
});

test('call', () => {
  expectDump("f = do{x: 0}, a = 1, b = f()")
    .toEqual({ f: 0, a: 1, b: 1 });
  expectCompiling("f = 0, a = 1, b = f()")
    .toThrow('Can only call a do-block');
  expectCompiling("f = do{x = 0}, a = 1, b = f()")
    .toThrow('Program input not defined');
  expectCompiling("f = do{x: ''}, a = 1, b = f()")
    .toThrow('changing type');
  expectDump("f = do{x: 0; y: 1}, a = 1, b = f(2)")
    .toEqual({ f: 1, a: 1, b: 2 });
  expectDump("f = do{x: 0; y: 1}, a = 1, b = f 2")
    .toEqual({ f: 1, a: 1, b: 2 });
  expectDump("f = do{x: 0; y: 1}, a = 1, b = f(.y := 2)")
    .toEqual({ f: 1, a: 1, b: 2 });
  expectCompiling("f = do{x: 0; y: 1}, a = 1, b = f(.z := 2)")
    .toThrow('Undefined name');
  expectCompiling("f = do{x: 0; y: 1}, a = 1, b = f(.y := 2, 2)")
    .toThrow('Only first argument can be anonymous');
});

test('formula', () => {
  expectDump("f = do{x: 0}, a = 1, b = a f()")
    .toEqual({ f: 0, a: 1, b: 1});
  expectDump("f = do{x: 0; y: 1}, a = 1, b = a f(2)")
    .toEqual({ f: 1, a: 1, b: 2 });
  expectDump("f = do{x: 0; y: 1}, a = 1, b = a f 2")
    .toEqual({ f: 1, a: 1, b: 2 });
  expectDump("f = do{x: 0; y: 1}, a = 1, b = a f 2 f 3")
    .toEqual({ f: 1, a: 1, b: 3 });
});

test('arithmetic', () => {
  expectDump("a = 1 + 2")
    .toEqual({ a: 3 });
  expectDump("a = 1 +(2)")
    .toEqual({ a: 3 });
  expectCompiling("a = '' + 0")
    .toThrow('changing type');
  expectCompiling("a = 1 + ''")
    .toThrow('changing type');
  expectDump("a = 1 + 2 * 3")
    .toEqual({ a: 9 });
  expectDump("a = 1 + (2 * 3)")
    .toEqual({ a: 7 });
});

test('conditionals', () => {
  expectDump("a? = 1 >? 0")
    .toEqual({ a: 0 })
  expectDump("a? = 0 >? 1")
    .toEqual({ a: false })
  expectCompiling("a = 1 >? 0")
    .toThrow('conditional field name must have suffix ?')
  expectCompiling("a? = 0")
    .toThrow('unconditional field name cannot have suffix ?')
  expectCompiling("a: 1 >? 0")
    .toThrow('input fields must be unconditional')
})

test('guarded references', () => {
  expectDump("a? = 1 >? 0, b? = a?")
    .toEqual({ a: 0, b: 0 })
  expectDump("a? = 0 >? 1, b? = a?")
    .toEqual({ a: false, b: false })
  expectCompiling("a? = 1 >? 0, b = a")
    .toThrow('conditional reference lacks suffix ? or !')
  expectCompiling("a = 1, b = a?")
    .toThrow('invalid reference suffix ?')
  expectCompiling("a? = 1 >? 0, b = a?")
    .toThrow('conditional field name must have suffix ?')
  expectCompiling("a? = 1 >? 0, b? = 0 a()")
    .toThrow('conditional reference lacks suffix ? or !')
  expectCompiling("a? = 1 >? 0, b? = + 1")
    .toThrow('Previous value is conditional')
  expectDump("a? = 1 >? 0 >? -1")
    .toEqual({ a: -1})
  expectDump("x = record{a? = 1 >? 0, b? = a?}, y? = x.a?")
    .toEqual({ x: { a: 0, b: 0 }, y: 0 })

})

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
