import { compile, expectCompiling, expectDump } from './basic.test';

/** @module
 *
 * update tests
 */

test('simple update', () => {
  let w = compile("a: 0");
  w.writeAt('a', 1);
  expect(w.dumpAt('a')).toEqual(1);
  expect(() => { w.writeAt('a', 'foo') }).toThrow('changing type of value')
});

test('update readonly', () => {
  let w = compile("a = 0");
  expect(() => { w.writeAt('a', 1) }).toThrow('unwritable location')
});

test('update type check', () => {
  let w = compile("a: 0");
  expect(() => { w.writeAt('a', 'foo') }).toThrow('changing type of value')
});
