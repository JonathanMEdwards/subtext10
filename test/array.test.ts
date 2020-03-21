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

