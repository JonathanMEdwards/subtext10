import { expectCompiling, expectDump } from './basic.test';

/** @module
 *
 * Series tests
 */

test('series definition', () => {
  expectDump("a = series {0}, b? = a[] =? 0")
    .toEqual({ a: [], b: 0 });
  expectDump("a = series {0}, b = series {0}, c? = a =? b")
    .toEqual({ a: [], b: [], c: [] });
  expectCompiling("a = series {0}, b = series {''}, c? = a =? b")
    .toThrow('changing type of value');
});

test('series add', () => {
  expectDump("a = series {0}, b = a & 1 & 2, c = b~index")
    .toEqual({ a: [], b: [1, 2], c: 2 });
  expectDump("a = series {0} & 1, b = series {0} & 1, c? = a =? b")
    .toEqual({ a: [1], b: [1], c: [1] });
  expectCompiling("a = series {0}, b = a & ''")
    .toThrow('changing type of value');
})

