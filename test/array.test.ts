import { expectCompiling, expectDump, compile, expectErrors } from "./exports"

test('array definition', () => {
  expectDump("a = array{0}, b? = a[] =? 0")
    .toEqual({ a: [], b: 0 });
  expectDump("a = array{###}, b = array{###}, c? = a =? b")
    .toEqual({ a: [], b: [], c: [] });
  expectErrors("a = array{###}, b = array{''}, c? = a =? b")
    .toContain('c: type');
});

test('text', () => {
  expectDump("a = ''; b = array{character' '}; c? = a =? b")
    .toEqual({ a: '', b: '', c: '' });
  expectDump("a = 'a'; b = array{character' '} & character'a'; c? = a =? b")
    .toEqual({ a: 'a', b: 'a', c: 'a' });
  expectDump("a = ' \\nfoo' skip-white() =! 'foo'")
  .toEqual({a: 'foo'})
})

test('array add/delete', () => {
  expectDump("a = array{###}, b = a & 1 & 2, c = b~index, d = b length()")
    .toEqual({ a: [], b: [1, 2], c: 2, d: 2 });
  expectDump("a = array{###} & 1, b = array{###} & 1, c? = a =? b")
    .toEqual({ a: [1], b: [1], c: [1] });
  expectErrors("a = array{0}, b = a & ''")
    .toContain('b: type');
  expectDump("a = array{###} & 1 & 2, b = a delete! 1")
    .toEqual({ a: [1, 2], b: [2] });
  expectDump("a = array{###} & 1 & 2, b? = a delete? 0")
    .toEqual({ a: [1, 2], b: false });
  expectCompiling("a = array{###} & 1 & 2, b = a delete! 0")
    .toThrow('assertion failed');
  expectDump("a = array{###} & 1 & 2 &&(array{###} & 3 & 4)")
    .toEqual({ a: [1, 2, 3, 4]});
})

test('tracked array', () => {
  expectDump(`
  a = tracked array{###} & 1 & 2 delete! 1
  b = tracked array{###} & 1 & 2 delete! 1
  c = tracked array{###} & 2
  t1? = a =? b
  t2? = a =? c
  `).toEqual({
    a: [2],
    b: [2],
    c: [2],
    t1: [2],
    t2: false
  });
})

test('array at/update', () => {
  expectDump("a = array{###} & 1 & 2; b = a at! 1; c? = a at? 0")
    .toEqual({ a: [1, 2], b: 1, c: false });
  expectDump("a = array{###} & 1 & 2; b = a update!(1, .value := -1)")
    .toEqual({ a: [1, 2], b: [-1, 2] });
  expectDump(`a = array{0} &(with{+ 1})`)
    .toEqual({ a: [1] });
  expectDump(`a = array{0} &{+ 1}`)
    .toEqual({ a: [1] });
  // expectCompiling(`a = array{0} & with{+ 1}`)
  //   .toThrow('expecting call argument');
  expectDump(`a = array{###} & 1; b = a update!(1, .value := with{+1})`)
    .toEqual({ a: [1], b: [2] });
})

test('tables', () => {
  expectDump(`
  a = table{x: 0, y: ''} &() &{.x := 1, .y := 'foo'}
  b = a.x
  c = a.y`)
    .toEqual({
      a: [{ x: 0, y: '' }, { x: 1, y: 'foo' }],
      b: [0, 1],
      c: ['', 'foo']
    });
})

test('find', () => {
  expectDump(`a = array{###} & 1 & 2; b = a find!{=? 1}; c = b~index`)
  .toEqual({a: [1, 2], b: 1, c: 1})
  expectDump(`a = array{###} & 1 & 2; b = a find!{=? 2}; c = b~index`)
  .toEqual({a: [1, 2], b: 2, c: 2})
  expectDump(`a = array{###} & 1; b? = a find?{=? 0}; c? = b?~index`)
  .toEqual({a: [1], b: false, c: false})
  expectCompiling(`a = array{###} & 1; b = a find!{=? 0}`)
  .toThrow('assertion failed')
  expectCompiling(`a = array{###} & 1; b = a find!{=? 0; 2}`)
  .toThrow('unused value')
  expectCompiling(`a = array{###} & 1; b = a find!{2}`)
    .toThrow('block must be conditional')
})

test('for-all', () => {
  expectDump(`a = array{###} & 1 & 2; b = a for-all{+ 1}`)
    .toEqual({ a: [1, 2], b: [2, 3] });
  expectDump(`
  a = array{###} & 1 & 2
  b = a for-all{
    n = that
    record{a: n, b: n + 1}
  }`)
    .toEqual({ a: [1, 2], b: [{ a: 1, b: 2 }, { a: 2, b: 3 }] });
})

test('such-that', () => {
  expectDump(`a = array{###} & 1 & 2 & 3; b = a such-that{check not=? 2}`)
    .toEqual({ a: [1, 2, 3], b: [1, 3]});
    expectDump(`a = array{###} & 1 & 2 & 3; b = a such-that{check not=? 0}`)
      .toEqual({ a: [1, 2, 3], b: [1, 2, 3]});
    expectDump(`a = array{###} & 1 & 2 & 3; b = a such-that{check not=? 2}`)
      .toEqual({ a: [1, 2, 3], b: [1, 3] });
})

test('all/none', () => {
  expectDump(`a = array{###} & 1 & 2 & 3; b? = a all?{>? 0}`)
    .toEqual({ a: [1, 2, 3], b: [1, 2, 3] });
  expectDump(`a = array{###} & 1 & 2 & 3; b? = a none?{<? 0}`)
    .toEqual({ a: [1, 2, 3], b: [1, 2, 3] });
  expectDump(`a = array{###} & 1 & 2 & 3; b? = a all?{=? 1}`)
    .toEqual({ a: [1, 2, 3], b: false });
  expectDump(`a = array{###} & 1 & 2 & 3; b? = a none?{=? 1}`)
    .toEqual({ a: [1, 2, 3], b: false });
})

test('accumulate', () => {
  expectDump(`
  a = array{###};
  b = a accumulate{item: []; sum: 0; sum + item}
  `)
    .toEqual({ a: [], b: 0 });
  expectDump(`
  a = array{###} & 1 & 2;
  b = a accumulate{item: []; sum: 0; sum + item}
  `)
    .toEqual({ a: [1, 2], b: 3 });
  expectCompiling(`
  a = array{###} & 1 & 2;
  b = a accumulate{item: 0; sum: 0; 'foo'}
  `)
    .toThrow('input must be []');
  expectCompiling(`
  a = array{###} & 1 & 2;
  b = a accumulate{item: []; sum: 0; 'foo'}
  `)
    .toThrow('result must be same type as accumulator');
})


test('selection', () => {
  expectDump('a: tracked array{###} & 1 & 2; s: selection{a}')
    .toEqual({ a: [1, 2], s: [] });
  expectDump('a: tracked array{###} & 1 & 2; s: selection{a} select! 1')
    .toEqual({ a: [1, 2], s: [1] });
  // forward selection
  expectDump(' s: selection{a} select! 1; a: tracked array{###} & 1 & 2')
    .toEqual({ a: [1, 2], s: [1] });
  expectDump(`
  a: tracked array{###} & 1 & 2
  s: selection{a} select! 1 select! 2 deselect! 1
  `)
    .toEqual({ a: [1, 2], s: [2] });
  expectDump(`
  a: tracked array{###}
  s = selection{a}
  t = selection{a}
  e? = s =? t
  `)
    .toEqual({ a: [], s: [], t: [], e: [] });
  expectDump(`
  a: tracked array{###} & 1
  s = selection{a} select! 1
  t = selection{a}
  e? = s =? t
  `)
    .toEqual({ a: [1], s: [1], t: [], e: false });
  expectErrors(`
  a: tracked array{###}
  b: tracked array{###}
  s = selection{a}
  t = selection{b}
  e? = s =? t
  `).toContain('e: type')
})

test('selection synthetics', () => {
  expectDump(`
  a: tracked array{###} & 1 & 2 & 3
  s: selection{a} select! 2
  t = s.selections
  u = s.backing
  i? = s.at?
  `)
    .toEqual({ a: [1, 2, 3], s: [2], t: [2], u: [1, 2, 3], i: 2 });
});

test('selecting block', () => {
  expectDump(`
  a: tracked array{###} & 1 & 2 & 3
  s: selection{a}
  t = s selecting{>? 2}
  `)
    .toEqual({ a: [1, 2, 3], s: [], t: [3]});
});

test('selection deletion', () => {
  let w = compile(`
  a: tracked array{###} & 1 & 2 & 3
  s: selection{a}
  `)
  w.selectAt('s', 1);
  w.selectAt('s', 3);
  expect(w.dump()).toEqual({a: [1, 2, 3], s: [1, 3]})
  w.deleteAt('a', 1);
  expect(w.dump()).toEqual({a: [2, 3], s: [2]})
})

test('reflexive selection', () => {
  let w = compile(`
  a: tracked table{as: selection{a}}
  `)
  w.createAt('a');
  w.selectAt('a.1.as', 1)
  expect(w.dump()).toEqual({
    a: [{ as: [1] }],
  })
})

test('cyclic selection', () => {
  let w = compile(`
  a: tracked table{bs: selection{b}}
  b: tracked table{as: selection{a}}
  `)
  w.createAt('a');
  w.createAt('b');
  w.selectAt('a.1.bs', 1)
  w.selectAt('b.1.as', 1)
  expect(w.dump()).toEqual({
    a: [{bs: [1]}],
    b: [{as: [1]}],
  })
})

test('linking', () => {
  let w = compile(`
  a: tracked table{bs: link{b via as}}
  b: tracked table{as: link{a via bs}}
  `)
  w.createAt('a');
  w.createAt('a');
  w.createAt('b');
  w.selectAt('a.1.bs', 1);
  w.selectAt('a.2.bs', 1);
  expect(w.dump()).toEqual({
    a: [{ bs: [1] }, { bs: [1] }],
    b: [{ as: [1, 2] }],
  });
  // update secondary link
  w.deselectAt('b.1.as', 1);
  expect(w.dump()).toEqual({
    a: [{ bs: [] }, { bs: [1] }],
    b: [{ as: [2] }],
  });
})

test('reflexive link', () => {
  let w = compile(`
  t: tracked table{
    a: link{t via b}
    b: link{t via a}}
  `)
  w.createAt('t');
  w.createAt('t');
  w.selectAt('t.1.a', 2);
  expect(w.dump()).toEqual({
    t: [
      { a: [2], b: [] },
      { a: [], b: [1] }
    ]});
  // update secondary link
  w.selectAt('t.1.b', 2);
  expect(w.dump()).toEqual({
    t: [
      { a: [2], b: [2] },
      { a: [1], b: [1] }
    ]
  });
})

test('link errors', () => {
  expectCompiling(`
  a: tracked table{bs: link{b via as}}
  b: tracked table{as: link{a via bs}}
  c: a[].bs
  `).toThrow('link must be a field of a tracked table');

  expectDump(`
  a: tracked table{bs: link{b via as}}
  b: tracked table{as: link{a via bs}}
  c = a[].bs
  `).toEqual({
    a: [],
    b: [],
    c: []
  });

  expectCompiling(`
  a: tracked table{bs: link{b via as}}
  b: table{as: link{a via bs}}
  `).toThrow('link requires a tracked table');

  expectCompiling(`
  a: tracked table{bs: link{b via foo}}
  b: tracked table{as: link{a via bs}}
  `).toThrow('Opposite link not defined');

  expectCompiling(`
  a: tracked table{bs: link{b via foo}}
  b: tracked table{foo: 0, as: link{a via bs}}
  `).toThrow('Opposite link does not match');
})

test('selection backing update', () => {
  let w = compile(`
  a: tracked array{###} & 1 & 2 & 3
  s: selection{a}
  i? =|> s.at?
  `)
  w.selectAt('s', 2);
  w.writeAt('s.selections.1', 10)
  expect(w.dump()).toEqual({ a: [1, 10, 3], s: [2], i: 10 })
  w.writeAt('s.at', 20)
  expect(w.dump()).toEqual({ a: [1, 20, 3], s: [2], i: 20 })
  w.writeAt('i', 30)
  expect(w.dump()).toEqual({ a: [1, 30, 3], s: [2], i: 30 })
})

