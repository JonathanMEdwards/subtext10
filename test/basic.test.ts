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

test('assertions', () => {
  expectDump("a = 1 >! 0")
    .toEqual({ a: 0 });
  expectCompiling("a = 0 >! 1")
    .toThrow('assertion failed: >!')
  expectCompiling("x = record{a? = 0 >? 1}, y = x.a!")
    .toThrow('assertion failed: a!')
})

test('try', () => {
  expectDump("a = try {0 >? 1} else {2}")
  .toEqual({a: 2})
  expectDump("a = try {1 >? 0} else {2}")
  .toEqual({a: 0})
  expectCompiling("a = try {0 >? 1} else {0 >? 1}")
    .toThrow('try failed')
  expectDump("a? = try {0 >? 1} else reject")
    .toEqual({ a: false })
  expectCompiling("a = try {0} else {0 >? 1}")
    .toThrow('try clause must be conditional if not last')
  expectCompiling("a? = try {0} else reject")
    .toThrow('try clause must be conditional if not last')
  expectCompiling("a = try {0 >? 1} else {'foo'}")
    .toThrow('try clauses must have same type result')
  expectDump("a = 0 try {>? 1} else {+ 2}")
    .toEqual({ a: 2 })
})

test('recursion', () => {
  expectCompiling("fac = do{n: 0, n fac()}")
    .toThrow('recursion outside secondary try clause');
  expectCompiling("fac = do{n: 0, try {n fac()}}")
    .toThrow('recursion outside secondary try clause');
  expectDump(`
    fac = do{n: 0, try {n <=? 0, 1} else {n - 1 fac() * n}},
    x = 1 fac()
    `)
    .toEqual({ fac: 1, x: 1 });
  expectDump(`
    fac = do{n: 0, try {n <=? 0, 1} else {n - 1 fac() * n}},
    x = 4 fac()
    `)
    .toEqual({ fac: 1, x: 24 });
  expectCompiling("fac = do{n: 0, try {0 <? 0, 1} else {n - 1 fac() * n}}")
    .toThrow('Workspace too deep');
})

test('mutual recursion', () => {
  expectDump(`
    even? = do{n: 0; try{n =? 0} else { n - 1 odd?()} else reject; n}
    odd? = do{n:1; n not=? 0; n - 1 even?(); n}
    x? = 1 even?()
    y? = 2 odd?()
    `)
    .toEqual({ "even": 0, "odd": 1, x: false, y: false });
  expectDump(`
    even? = do{n: 0; try{n =? 0} else { n - 1 odd?()} else reject; n}
    odd? = do{n:1; n not=? 0; n - 1 even?(); n}
    x? = 2 even?()
    y? = 3 odd?()
    `)
    .toEqual({ "even": 0, "odd": 1, x: 2, y: 3 });
});

// test('generics', () => {
//   expectCompiling("a? = 1 =? 2")
//     .not.toThrow();
//   expectCompiling("a? = 1 =? ''")
//     .toThrow('Type mismatch');
// });

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
