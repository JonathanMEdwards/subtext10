import { compile, expectCompiling, expectDump } from './basic.test';

/** @module
 *
 * update tests
 */

test('write update', () => {
  let w = compile("a: 0");
  w.updateAt('a', 1);
  expect(w.dumpAt('a')).toEqual(1);
  expect(() => { w.updateAt('a', 'foo') }).toThrow('changing type of value')
});

test('choice update', () => {
  let w = compile("a: choice{x?: 0; y?: 'foo'}");
  w.updateAt('a', 'y');
  w.updateAt('a.y', 'bar');
  expect(w.dumpAt('a')).toEqual({y: 'bar'});
});

test('update readonly', () => {
  let w = compile("a = 0");
  expect(() => { w.updateAt('a', 1) }).toThrow('cannot update')
});

test('update type check', () => {
  let w = compile("a: 0");
  expect(() => { w.updateAt('a', 'foo') }).toThrow('changing type of value')
});

test('updatable output', () => {
  let w = compile("c: 0, f =|> c * 1.8 + 32 on-update{write - 32 / 1.8 -> c}");
  expect(w.dumpAt('f')).toEqual(32);
  w.updateAt('f', 212);
  expect(w.dumpAt('c')).toEqual(100);
});

test('reverse formula', () => {
  let w = compile("c: 0, f =|> c * 1.8 + 32");
  expect(w.dumpAt('f')).toEqual(32);
  w.updateAt('f', 212);
  expect(w.dumpAt('c')).toEqual(100);
});

test('literal update', () => {
  expect(() => compile("c: 0, f =|> 0"))
    .toThrow('cannot update');
});

test('constant formula update', () => {
  expect(() => compile("c: 0, f =|> 0 * 1.8 + 32"))
    .toThrow('cannot update');
});

test('update propagation', () => {
  let w = compile(`
  s = record {
    c: 0;
    f =|> c * 1.8 + 32 on-update{write - 32 / 1.8 -> c}
  }
  t = .f := 212
  u = s with{.f := 212}`);
  expect(w.dumpAt('t')).toEqual({c: 100, f: 212});
  expect(w.dumpAt('u')).toEqual({c: 100, f: 212});
});

test('reverse formula in update', () => {
  let w = compile(`
  s = record {
    c: 0;
    f =|> c * 1.8 + 32
  }
  t = .f := 212
  u = s with{.f := 212}`);
  expect(w.dumpAt('s')).toEqual({c: 0, f: 32});
  expect(w.dumpAt('t')).toEqual({c: 100, f: 212});
  expect(w.dumpAt('u')).toEqual({c: 100, f: 212});
});

test('write type check', () => {
  expectCompiling("c: 0, f =|> c on-update{write 'foo' -> c}")
    .toThrow('write changing type');
});

test('write order check', () => {
  expectCompiling("c: 0, f =|> c on-update{write -> g}, g: 0")
    .toThrow('write must go backwards');
});

test('conditional on-update', () => {
  let w = compile(`
  c: 0
  f =|> c * 1.8 + 32 on-update{
    try {
      check 1 =? 2
      write 50 -> c
    }
    else {
      write - 32 / 1.8 -> c
    }
  }`);
  w.updateAt('f', 212);
  expect(w.dumpAt('c')).toEqual(100);
});

test('conditional on-update 2', () => {
  let w = compile(`
  c: 0
  f =|> c * 1.8 + 32 on-update{
    try {
      check 1 not=? 2
      write 50 -> c
    }
    else {
      write - 32 / 1.8 -> c
    }
  }`);
  w.updateAt('f', 212);
  expect(w.dumpAt('c')).toEqual(50);
});

test('conditional on-update in update', () => {
  // tricky because of analysis deferral
  let w = compile(`
  s = record {
    c: 0
    f =|> c * 1.8 + 32 on-update{
      try {
        check 1 =? 2
        write 50 -> c
      }
      else {
        write - 32 / 1.8 -> c
      }
    }
  }
  t = s with{.f := 212}
  `);
  expect(w.dumpAt('t.c')).toEqual(100);
});

test('reverse conditional update', () => {
  let w = compile(`
  c: 0
  f =|> do{
    try {
      check 1 =? 2
      c + 1
    }
    else {
      c + 2
    }
  }`);
  w.updateAt('f', 100);
  expect(w.dumpAt('c')).toEqual(98);
});

test('reverse conditional update 2', () => {
  let w = compile(`
  c: 0
  f =|> do{
    try {
      check 1 not=? 2
      c + 1
    }
    else {
      c + 2
    }
  }`);
  w.updateAt('f', 100);
  expect(w.dumpAt('c')).toEqual(99);
});


test('update aggregation', () => {
  let w = compile(`
  s: record {
    c: 0
    d: 0
  }
  t =|> s`);
  w.updateAt('t.c', 100);
  expect(w.dumpAt('s')).toEqual({c: 100, d: 0});
})

test('update aggregation 2', () => {
  let w = compile(`
  s: record {
    c: 0
    d =|> c
  }
  t =|> s`);
  w.updateAt('t.d', 100);
  expect(w.dumpAt('s')).toEqual({c: 100, d: 100});
})

test('moot update', () => {
  let w = compile("c: 0, f =|> false on-update{write c <- + 1}");
  w.updateAt('f', true);
  expect(w.dumpAt('c')).toEqual(1);
  w.updateAt('f', false);
  expect(w.dumpAt('c')).toEqual(1);
});

test('update propagation order', () => {
  let w = compile(`
  c: 0
  f =|> record{x: 0, y: 0} on-update{write c <- + 1}
  g =|> false on-update{write 1 -> f.x; write 1 -> f.y}
  `);
  w.updateAt('g', true);
  expect(w.dumpAt('c')).toEqual(1);
});

test('update overwrite', () => {
  let w = compile(`
  c: 0
  g =|> false on-update{write 1 -> c; write 2 -> c}
  `);
  w.updateAt('g', true);
  expect(w.dumpAt('c')).toEqual(2);
});

test('reverse update', () => {
  let w = compile(`
  u = record {
    a: 0
    b: record{x: 0, y: 0}
    c =|> b with{.x := a}
  }
  v = u with{.c.x := 1}
  `);
  expect(w.dumpAt('v.a')).toEqual(1);
  expect(w.dumpAt('v.b')).toEqual({x: 0, y: 0});
});
