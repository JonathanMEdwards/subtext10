import { expectCompiling, expectDump } from './basic.test';

/** @module
 *
 * array tests
 */

test('array definition', () => {
  expectDump("a = array {0}, b? = a[] =? 0")
    .toEqual({ a: [], b: 0 });
  expectDump("a = array {0}, b = array {0}, c? = a =? b")
    .toEqual({ a: [], b: [], c: [] });
  expectCompiling("a = array {0}, b = array {''}, c? = a =? b")
    .toThrow('changing type of value');
});

test('text', () => {
  expectDump("a = ''; b = array {character' '}; c? = a =? b")
    .toEqual({ a: '', b: '', c: '' });
  expectDump("a = 'a'; b = array {character' '} & character'a'; c? = a =? b")
    .toEqual({ a: 'a', b: 'a', c: 'a' });
  expectDump("a = ' \\nfoo' skip-white() =! 'foo'")
  .toEqual({a: 'foo'})
})

test('array add/delete', () => {
  expectDump("a = array {0}, b = a & 1 & 2, c = b~index, d = b length()")
    .toEqual({ a: [], b: [1, 2], c: 2, d: 2 });
  expectDump("a = array {0} & 1, b = array {0} & 1, c? = a =? b")
    .toEqual({ a: [1], b: [1], c: [1] });
  expectCompiling("a = array {0}, b = a & ''")
    .toThrow('changing type of value');
  expectDump("a = array {0} & 1 & 2, b = a delete! 1")
    .toEqual({ a: [1, 2], b: [2] });
  expectDump("a = array {0} & 1 & 2, b? = a delete? 0")
    .toEqual({ a: [1, 2], b: false });
  expectCompiling("a = array {0} & 1 & 2, b = a delete! 0")
    .toThrow('assertion failed');
  expectDump("a = array {0} & 1 & 2 followed-by(array {0} & 3 & 4)")
    .toEqual({ a: [1, 2, 3, 4]});
})

test('tracked array', () => {
  expectDump(`
  a = tracked array {0} & 1 & 2 delete! 1
  b = tracked array {0} & 1 & 2 delete! 1
  c = tracked array {0} & 2
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
  expectDump("a = array {0} & 1 & 2; b = a at! 1; c? = a at? 0")
    .toEqual({ a: [1, 2], b: 1, c: false });
  expectDump("a = array {0} & 1 & 2; b = a update!(1, .value := -1)")
    .toEqual({ a: [1, 2], b: [-1, 2] });
  expectDump(`a = array{0} &(with{+ 1})`)
    .toEqual({ a: [1] });
  expectCompiling(`a = array{0} & with{+ 1}`)
    .toThrow('expecting call argument');
  expectDump(`a = array{0} & 1; b = a update!(1, .value := with{+1})`)
    .toEqual({ a: [1], b: [2] });
})

test('tables', () => {
  expectDump(`
  a = table{x: 0, y: ''} &() &(with{.x := 1, .y := 'foo'})
  b = a.x
  c = a.y`)
    .toEqual({
      a: [{ x: 0, y: '' }, { x: 1, y: 'foo' }],
      b: [0, 1],
      c: ['', 'foo']
    });
})

test('find', () => {
  expectDump(`a = array{0} & 1 & 2; b = a find!{=? 1}; c = b~index`)
  .toEqual({a: [1, 2], b: 1, c: 1})
  expectDump(`a = array{0} & 1 & 2; b = a find!{=? 2}; c = b~index`)
  .toEqual({a: [1, 2], b: 2, c: 2})
  expectDump(`a = array{0} & 1; b? = a find?{=? 0}; c? = b?~index`)
  .toEqual({a: [1], b: false, c: false})
  expectCompiling(`a = array{0} & 1; b = a find!{=? 0}`)
  .toThrow('assertion failed')
  expectCompiling(`a = array{0} & 1; b = a find!{=? 0; 2}`)
  .toThrow('unused value')
  expectCompiling(`a = array{0} & 1; b = a find!{2}`)
    .toThrow('block must be conditional')
})

test('for-all', () => {
  expectDump(`a = array{0} & 1 & 2; b = a for-all{+ 1}`)
    .toEqual({ a: [1, 2], b: [2, 3] });
  expectDump(`
  a = array{0} & 1 & 2
  b = a for-all{
    n = that
    record{a: n, b: n + 1}
  }`)
    .toEqual({ a: [1, 2], b: [{ a: 1, b: 2 }, { a: 2, b: 3 }] });
})

test('such-that', () => {
  expectDump(`a = array{0} & 1 & 2 & 3; b = a such-that{check not=? 2}`)
    .toEqual({ a: [1, 2, 3], b: [1, 3]});
    expectDump(`a = array{0} & 1 & 2 & 3; b = a such-that{check not=? 0}`)
      .toEqual({ a: [1, 2, 3], b: [1, 2, 3]});
    expectDump(`a = array{0} & 1 & 2 & 3; b = a such-that{check not=? 2}`)
      .toEqual({ a: [1, 2, 3], b: [1, 3] });
})

test('all/none', () => {
  expectDump(`a = array{0} & 1 & 2 & 3; b? = a all?{>? 0}`)
    .toEqual({ a: [1, 2, 3], b: [1, 2, 3] });
  expectDump(`a = array{0} & 1 & 2 & 3; b? = a none?{<? 0}`)
    .toEqual({ a: [1, 2, 3], b: [1, 2, 3] });
  expectDump(`a = array{0} & 1 & 2 & 3; b? = a all?{=? 1}`)
    .toEqual({ a: [1, 2, 3], b: false });
  expectDump(`a = array{0} & 1 & 2 & 3; b? = a none?{=? 1}`)
    .toEqual({ a: [1, 2, 3], b: false });
})

test('accumulate', () => {
  expectDump(`
  a = array{0};
  b = a accumulate{item: []; sum: 0; sum + item}
  `)
    .toEqual({ a: [], b: 0 });
  expectDump(`
  a = array{0} & 1 & 2;
  b = a accumulate{item: []; sum: 0; sum + item}
  `)
    .toEqual({ a: [1, 2], b: 3 });
  expectCompiling(`
  a = array{0} & 1 & 2;
  b = a accumulate{item: 0; sum: 0; 'foo'}
  `)
    .toThrow('input must be []');
  expectCompiling(`
  a = array{0} & 1 & 2;
  b = a accumulate{item: []; sum: 0; 'foo'}
  `)
    .toThrow('result must be same type as accumulator');
})
