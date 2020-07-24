import { compile, expectCompiling, expectDump } from './basic.test';

/** @module
 *
 * update tests
 */

test('write update', () => {
  let w = compile("a: 0");
  w.writeAt('a', 1);
  expect(w.dumpAt('a')).toEqual(1);
  expect(() => { w.writeAt('a', 'foo') }).toThrow('changing type of value')
});

test('choice update', () => {
  let w = compile("a: choice{x?: 0; y?: 'foo'}");
  w.writeAt('a', 'y');
  w.writeAt('a.y', 'bar');
  expect(w.dumpAt('a')).toEqual({y: 'bar'});
});

test('update readonly', () => {
  let w = compile("a = 0");
  expect(() => { w.writeAt('a', 1) }).toThrow('unwritable location')
});

test('update type check', () => {
  let w = compile("a: 0");
  expect(() => { w.writeAt('a', 'foo') }).toThrow('changing type of value')
});

test('updatable output', () => {
  let w = compile("c: 0, f =|> c * 1.8 + 32 update{write - 32 / 1.8 -> c}");
  expect(w.dumpAt('f')).toEqual(32);
  w.writeAt('f', 212);
  expect(w.dumpAt('c')).toEqual(100);
});

test('reverse formula', () => {
  let w = compile("c: 0, f =|> c * 1.8 + 32");
  expect(w.dumpAt('f')).toEqual(32);
  w.writeAt('f', 212);
  expect(w.dumpAt('c')).toEqual(100);
});

test('update in replace', () => {
  let w = compile(`
  s = record {
    c: 0;
    f =|> c * 1.8 + 32 update{write - 32 / 1.8 -> c}
  }
  t = .f := 212
  u = s with{.f := 212}`);
  expect(w.dumpAt('t')).toEqual({c: 100, f: 212});
  expect(w.dumpAt('u')).toEqual({c: 100, f: 212});
});

test('reverse formula in replace', () => {
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
  expectCompiling("c: 0, f =|> c update{write 'foo' -> c}")
    .toThrow('write changing type');
});

test('write order check', () => {
  expectCompiling("c: 0, f =|> c update{write -> g}, g: 0")
    .toThrow('write must go backwards');
});

test('conditional update', () => {
  let w = compile(`
  c: 0
  f =|> c * 1.8 + 32 update{
    try {
      check 1 =? 2
      write 50 -> c
    }
    else {
      write - 32 / 1.8 -> c
    }
  }`);
  w.writeAt('f', 212);
  expect(w.dumpAt('c')).toEqual(100);
});

test('conditional update 2', () => {
  let w = compile(`
  c: 0
  f =|> c * 1.8 + 32 update{
    try {
      check 1 not=? 2
      write 50 -> c
    }
    else {
      write - 32 / 1.8 -> c
    }
  }`);
  w.writeAt('f', 212);
  expect(w.dumpAt('c')).toEqual(50);
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
  w.writeAt('f', 100);
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
  w.writeAt('f', 100);
  expect(w.dumpAt('c')).toEqual(99);
});



// equality testing
// glitch avoidance
// change aggregation
// overwrites
