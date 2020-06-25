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
