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

test('array add', () => {
  expectDump("a = array {0}, b = a & 1 & 2, c = b~index")
    .toEqual({ a: [], b: [1, 2], c: 2 });
  expectDump("a = array {0} & 1, b = array {0} & 1, c? = a =? b")
    .toEqual({ a: [1], b: [1], c: [1] });
  expectCompiling("a = array {0}, b = a & ''")
    .toThrow('changing type of value');
})

