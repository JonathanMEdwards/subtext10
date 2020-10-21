import { Workspace} from "../src/exports";

/** @module
 *
 * Basic tests
 */

/** Compile a workspace from source */
export function compile(source: string) {
  return Workspace.compile(source);
}

/** Compile and dump at a location to plain JS object */
export function expectDump(source: string, at = '') {
  return expect(compile(source).dumpAt(at));
}

/** Test compiler exceptions */
export function expectCompiling(source: string) {
  return expect(() => compile(source));
}

test('literal outputs', () => {
  expectDump("a = 0, b = 'foo', c = nil, d = record{x = 0, y: 1}")
    .toEqual({ a: 0, b: 'foo', c: null, d: { x: 0, y: 1 } });
});

test('literal inputs', () => {
  expectDump("a: 0, b: 'foo', c: nil, d: record{x = 0, y: 1}")
    .toEqual({ a: 0, b: 'foo', c: null, d: { x: 0, y: 1 }  });
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
  expectDump("a = do{check 1; 2}")
    .toEqual({ a: 2 });
  expectDump("a = do{1; that}")
    .toEqual({ a: 1 });
  expectDump("a = do{record{x: 0}; .x}")
    .toEqual({ a: 0 });
  expectDump("a = 0; b = that")
    .toEqual({ a: 0, b: 0 });
  expectDump("a = 0; b = with{that}")
    .toEqual({ a: 0, b: 0 });
});

test('statement skipping', () => {
  expectCompiling("a = do{1; 2}")
    .toThrow('unused value');
  expectDump("a = do{1; check 2}")
    .toEqual({ a: 1 });
  expectCompiling("a = do{check 1; check 2}")
    .toThrow('code block has no result');
  expectCompiling("a = do{1; let x = + 2}")
    .toThrow('unused value');
  expectDump("a = do{1; let x = 2; + x}")
    .toEqual({ a: 3 });
  expectDump("a = do{1; let x = + 2; x}")
    .toEqual({ a: 3 });
  expectCompiling("a = do{1; let x = + 2; 3}")
    .toThrow('unused value');
})

test('update', () => {
  expectDump("a = record{x: 0, y : 0}, b = .x := 1")
    .toEqual({ a: {x: 0, y: 0}, b: {x: 1, y: 0}});
  expectDump("a = record{x: 0, y : 0}, b = a with{.x := 1}")
    .toEqual({ a: {x: 0, y: 0}, b: {x: 1, y: 0}});
  expectDump(`
  a = record{x: 0, y : record{i: 0, j: 0}}
  b = .y := with{.i := 1}
  `)
    .toEqual({
      a: { x: 0, y: { i: 0, j: 0 } },
      b: { x: 0, y: { i: 1, j: 0 } }
    });
  expectDump(`
  a = record{x: 0, y : record{i: 0, j: 0}}
  b = .y := with{.i := + 1}
  `)
    .toEqual({
      a: { x: 0, y: { i: 0, j: 0 } },
      b: { x: 0, y: { i: 1, j: 0 } },
    });
  expectCompiling("a = record{x = 0, y : 0}, b = .x := 1")
    .toThrow('not updatable');
  expectCompiling("a = record{x: 0, y : 0}, b = .x := 'foo'")
    .toThrow('changing type');
});

test('update reference translation', () => {
  expectDump(`
  a = record{x: 0, y : record{i: 0, j = x}}
  b = .y := with{.i := + 1}
  c = .x := 1
  `)
    .toEqual({
      a: { x: 0, y: { i: 0, j: 0 } },
      b: { x: 0, y: { i: 1, j: 0 } },
      c: { x: 1, y: { i: 1, j: 1 } }
    });
});

test('call', () => {
  expectDump("f = do{x: 0}, a = 1, b = f()")
    .toEqual({ f: 0, a: 1, b: 1 });
  expectCompiling("f = 0, a = 1, b = f()")
    .toThrow('Can only call a do-block');
  expectCompiling("f = do{x = 0}, a = 1, b = f()")
    .toThrow('function input not defined');
  expectCompiling("f = do{x: ''}, a = 1, b = f()")
    .toThrow('changing type');
  expectDump("f = do{x: 0; y: x}, a = 1, b = f(2)")
    .toEqual({ f: 0, a: 1, b: 2 });
  expectDump("f = do{x: 0; y: x}, a = 1, b = f 2")
    .toEqual({ f: 0, a: 1, b: 2 });
  expectDump("f = do{x: 0; y: x}, a = 1, b = f(.y := 2)")
    .toEqual({ f: 0, a: 1, b: 2 });
  expectCompiling("f = do{x: 0; y: x}, a = 1, b = f(.z := 2)")
    .toThrow('Undefined name');
  expectCompiling("f = do{x: 0; y: x}, a = 1, b = f(.y := 2, 2)")
    .toThrow('Only first argument can be anonymous');
});

test('formula', () => {
  expectDump("f = do{x: 0}, a = 1, b = a f()")
    .toEqual({ f: 0, a: 1, b: 1});
  expectDump("f = do{x: 0; y: x}, a = 1, b = a f()")
    .toEqual({ f: 0, a: 1, b: 1 });
  expectDump("f = do{x: 0; y: x}, a = 1, b = a f(2)")
    .toEqual({ f: 0, a: 1, b: 2 });
  expectDump("f = do{x: 0; y: x}, a = 1, b = a f 2")
    .toEqual({ f: 0, a: 1, b: 2 });
  expectDump("f = do{x: 0; y: x}, a = 1, b = a f 2 f 3")
    .toEqual({ f: 0, a: 1, b: 3 });
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

test('leading infix operator', () => {
  expectDump("c: 0, f = + 32")
    .toEqual({ c: 0, f: 32 });
  expectDump("c: 0, f = * 1.8 + 32")
    .toEqual({ c: 0, f: 32 });
})

test('conditionals', () => {
  expectDump("a? = 'foo' =? 'foo'")
    .toEqual({ a: 'foo' })
  expectDump("a? = 'foo' =? 'bar'")
    .toEqual({ a: false })
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
    .toThrow('clause must be conditional if not last')
  expectCompiling("a? = try {0} else reject")
    .toThrow('clause must be conditional if not last')
  expectCompiling("a = try {0 >? 1} else {'foo'}")
    .toThrow('clauses must have same type result')
  expectDump("a = 0 try {>? 1} else {+ 2}")
    .toEqual({ a: 2 })
})

test('recursion', () => {
  expectDump(`
    fac = do{n: 0; try {check n <=? 0; 1} else {n - 1 fac() * n}},
    x = 1 fac()
    `)
    .toEqual({ fac: 1, x: 1 });
  expectDump(`
    fac = do{n: 1; try {check n <=? 0; 1} else {n - 1 fac() * n}},
    x = 1 fac()
    `)
    .toEqual({ fac: 1, x: 1 });
  expectDump(`
    fac = do{n: 0; try {check n <=? 0; 1} else {n - 1 fac() * n}},
    x = 4 fac()
    `)
    .toEqual({ fac: 1, x: 24 });
  expectCompiling("fac = do{n: 0, n fac()}")
    .toThrow('Recursive call outside secondary try clause');
  expectCompiling("fac = do{n: 0, try {n fac()}}")
    .toThrow('Recursive call outside secondary try clause');
  expectCompiling("fac = do{n: 0; try {check 0 <? 0, 1} else {n - 1 fac() * n}}")
    .toThrow('Workspace too deep');
})

test('mutual recursion', () => {
  expectDump(`
    even? = do{n: 0; try{n =? 0} else { check n - 1 odd?(); n} else reject}
    odd? = do{n:1; check n not=? 0; check n - 1 even?(); n}
    x? = 1 even?()
    y? = 2 odd?()
    `)
    .toEqual({ even: 0, odd: 1, x: false, y: false });
  expectDump(`
    even? = do{n: 0; try{n =? 0} else { check n - 1 odd?(); n} else reject}
    odd? = do{n:1; check n not=? 0; check n - 1 even?(); n}
    x? = 2 even?()
    y? = 3 odd?()
    `)
    .toEqual({ even: 0, odd: 1, x: 2, y: 3 });
});

test('dynamic input defaults', () => {
  expectDump("f = do{x:0, y: x + 1}, a = 1 f()")
    .toEqual({f: 1, a: 2})
  expectDump("f = do{x:0, y: x + 1}, a = 1 f(+ 1)")
    .toEqual({f: 1, a: 3})
  expectDump("f = do{x:0, y: x + 1}, a = 1 f(+ 1)")
    .toEqual({f: 1, a: 3})
})

test('generics', () => {
  expectDump("a? = 1 =? 2")
    .toEqual({a: false});
  expectCompiling("a? = 1 =? ''")
    .toThrow('changing type of value');
  expectDump(`
  a = record{x: 0, y: ''}
  b = a
  c? = a =? b
  `)
    .toEqual({
      a: { x: 0, y: '' },
      b: { x: 0, y: '' },
      c: { x: 0, y: '' }
    });
  expectDump(`
  a = record{x: 0, y: ''}
  b = a with{.x := 1}
  c? = a =? b
  `)
    .toEqual({
      a: { x: 0, y: '' },
      b: { x: 1, y: '' },
      c: false
    });
  expectCompiling(`
  a = record{x: 0, y: ''}
  b = record{x: 0, y: ''}
  c? = a =? b
  `)
    .toThrow('changing type of value')
});

test('choices', () => {
  expectDump("a: choice{x?: 1, y?: ''}")
    .toEqual({ a: { x: 1 } });
  expectDump("a = choice{x?: 1, y?: ''}; b = #y('foo')")
    .toEqual({ a: { x: 1 }, b: { y: 'foo' } });
  expectDump("a = choice{x?: 1, y?: ''}; b = with{#y('foo')}")
    .toEqual({ a: { x: 1 }, b: { y: 'foo' } });
  expectDump("a = choice{x?: 1, y?: ''}; b = #y('foo')")
    .toEqual({ a: { x: 1 }, b: { y: 'foo' } });
  expectDump("a = choice{x?: 1, y?: ''}; b = a #y('foo')")
    .toEqual({ a: { x: 1 }, b: { y: 'foo' } });
  expectDump("a = choice{x?: 1, y?: ''}; b = a #y()")
    .toEqual({ a: { x: 1 }, b: { y: '' } });
  expectDump("a = choice{x?: 1, y?: ''}; b = a #x(+ 1); c = b #x()")
    .toEqual({ a: { x: 1 }, b: { x: 2 }, c: {x: 1} });
  expectDump("a = choice{x?: 1, y?: ''}; b = a #x(+ 1); c = b #x(+ 1)")
    .toEqual({ a: { x: 1 }, b: { x: 2 }, c: { x: 2 } });
  expectDump("a = choice{x?: 1, y?: ''}; b = a #x(+ 1); c = with{.x! := + 1}")
    .toEqual({ a: { x: 1 }, b: { x: 2 }, c: { x: 3 } });
  expectCompiling("a: choice{x: 1, y?: ''}")
    .toThrow('Option names must end in ?');
  expectCompiling("a: choice{x? = 1, y?: ''}")
    .toThrow('Option must be an input (:)');
  expectCompiling("a = choice{x?: 1, y?: ''}; b = a #x('foo')")
    .toThrow('changing type of value');
  expectCompiling("a = choice{x?: 1, y?: ''}; b = a #z('foo')")
    .toThrow('no such option');
  expectDump("a: choice{x?: 1, y?: ''}; b? = a.x?")
    .toEqual({ a: { x: 1 }, b: 1 });
  expectDump("a: choice{x?: 1, y?: ''}; b? = a.y?")
    .toEqual({ a: { x: 1 }, b: false });
  expectCompiling("a: choice{x?: 1, y?: ''}, b? = a.x")
    .toThrow('conditional reference lacks suffix ?');
})

test('recursive choices', () => {
  expectDump("a: choice{x?: 1, y?: a}")
  .toEqual({ a: { x: 1 } });
  expectDump("a = choice{x?: 1, y?: a}")
  .toEqual({ a: { x: 1 } });
  expectCompiling("a: choice{x?: a, y?: 1}")
    .toThrow('Circular reference');
  expectDump("a: choice{x?: 1, y?: a}; b = a #y()")
  .toEqual({ a: { x: 1 }, b: { y: { x: 1 }} });
  expectDump("a: choice{x?: 1, y?: b}, b: choice{z?: 1, w?: a}")
    .toEqual({ a: { x: 1 }, b: { z: 1 } });
  expectDump(`
  a: choice{x?: 1, y?: b}
  b: choice{z?: 1, w?: a}
  c = a #y()
  `)
   .toEqual({ a: { x: 1 }, b: { z: 1 }, c: { y: { z: 1 } } });
  expectDump(`
  a: choice{x?: 1, y?: b}
  b: choice{z?: 1, w?: a}
  c = a #y(#w())
  `)
    .toEqual({
      a: { x: 1 },
      b: { z: 1 },
      c: { y: { w: { x: 1 } } }
    });
  expectDump(`
  a: choice{x?: 1, y?: b}
  b: choice{z?: 1, w?: a}
  c = a #y(b)
  `)
    .toEqual({
      a: { x: 1 },
      b: { z: 1 },
      c: { y: { z: 1 } }
    });
  expectCompiling("a: choice{x?: b, y?: 1}, b: choice{x?: a, y?: 1}")
    .toThrow('Circular reference');
});

test('exports', () => {
  expectDump("a = do{1; export 2}, b = a~")
    .toEqual({ a: 1, b: 2 })
  // implicit export
  expectDump("a = do{do{1; export 2}}, b = a~")
    .toEqual({ a: 1, b: 2 })
  // named export
  expectDump("a = do{1; export foo = 2}, b = a~")
    .toEqual({ a: 1, b: { foo: 2 } })
  // call export
  expectDump("f = do{n: 0; export nil}; b = 1 f(); c = b~")
    .toEqual({ f: 0, b: 1, c: null })
  // builtin export
  expectDump("a = 1.5 truncate(), b = a~fraction")
    .toEqual({ a: 1, b: .5 })
  // try exports
  expectDump(`
  a = do {
    try
      clause1? = {1 >? 0; export 2 }
      clause2? = else {1; export 'foo'}}
  b = a~
  `)
    .toEqual({ a: 0, b: {clause1: 2} })
  expectDump(`
  a = do {
    try
      clause1? = {0 >? 1; export 2 }
      clause2? = else {2; export 'foo'}}
  b = a~
  `)
    .toEqual({ a: 2, b: {clause2: 'foo'} })
  expectDump(`
  a = do {
    try
      clause1? = {0 >? 1; export 2 }
      clause2? = else {2; export 'foo'}}
  b? = a~clause2?
  `)
    .toEqual({ a: 2, b: 'foo' })
  expectDump(`
  a = do {
    try
      clause1? = {0 >? 1; export 2 }
      clause2? = else {2; export 'foo'}}
  b? = a~clause1?
  `)
    .toEqual({ a: 2, b: false })
})

test('conditional export', () => {
  expectDump("a? = do{ 1 >? 0; export 2}; b? = a?~")
  .toEqual({a: 0, b: 2})
  expectDump("a? = do{ 1 >? 2; export 2}; b? = a?~")
  .toEqual({a: false, b: false})
  expectCompiling("a? = do{ 1 >? 2; export 2}; b? = a~?")
  .toThrow('? or ! goes before ~ not after')
  expectCompiling("a? = do{ 1 >? 2; export 2}; b? = a~")
    .toThrow('conditional reference lacks suffix ? or !')
})

test('recursive export', () => {

  // recursive try export with anon export
  expectDump(`
  a = do{
    n: 1
    try
      base?= {n <? 1; export nil}
      recurse?= else{
        n - 1 a()
        export(a~) ~
      }
  }
  b = a~
  c = 0 a()~
  d? = b =? c
  `).toEqual({
    a: 1,
    b: { recurse: { base: null } },
    c: { base: null },
    d: false
  })

  // recursive try export with named export
  expectDump(`
  a = do{
    n: 1
    try
      base?= {n <? 1; export nil}
      recurse?= else{
        n - 1 a()
        export(a~) foo = ~
      }
  }
  b = a~
  c = 0 a()~
  d? = b =? c
  `).toEqual({
      a: 1,
      b: { recurse: { foo: { base: null } } },
      c: { base: null },
    d: false
  })

  expectCompiling(`
  a = do{
    n: 1
    try
      base?= {n <? 1; export nil}
      recurse?= else{
        n - 1 a()
      }
  }
  `).toThrow('recursive export must define reference')

  expectCompiling(`
  a = do{
    n: 1
    try
      base?= {n <? 1; export nil}
      recurse?= else{
        n - 1 a()
        export(a) ~
      }
  }
  `).toThrow('export reference must end with ~')

  expectCompiling(`
  a = do{
    n: 1
    try
      base?= {n <? 1; export nil}
      recurse?= else{
        n - 1 a()
        export(a~) 1
      }
  }
  `).toThrow('changing type of value')
})

test('extend', () => {
  expectDump(`
  e = record{a: 0} extend{b = a + 1}
  f = with{.a := 1}`)
    .toEqual({
      e: { a: 0, b: 1 },
      f: { a: 1, b: 2 }
    })
})