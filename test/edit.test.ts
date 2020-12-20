import { compile, expectCompiling, off } from './basic.test';

/** @module
 *
 * edit tests
 */

test('replace', () => {

  let w = compile(`
  a:: 0
  as:: array{0}
  `);
  w.createAt('as')
  w.editAt('a', `::replace ''`)
  expect(w.dump()).toEqual({ a: '', as: [0] });
  w.editAt('as.0', `::replace ''`);
  expect(w.dump()).toEqual({ a: '', as: [''] });
});

test('append', () => {
  let w = compile(`
  a:: record{x:: 0}
  as:: table{x:: 0}
  `);
  w.createAt('as')
  w.editAt('', `::append{y:: ''}`)
  w.editAt('a', `::append{y:: ''}`)
  w.editAt('as.0', `::append{y:: ''}`);
  expect(w.dump()).toEqual({ a: { x: 0, y: '' }, as: [{x: 0, y: ''}], y: '' });
});

test('insert', () => {
  let w = compile(`
  a:: record{x:: 0}
  as:: table{x:: 0}
  `);
  w.createAt('as')
  w.editAt('a', `::insert{y:: ''}`)
  w.editAt('a.x', `::insert{y:: ''}`)
  w.editAt('as.0.x', `::insert{y:: ''}`);
  expect(w.dump()).toEqual({ a: { x: 0, y: '' }, as: [{x: 0, y: ''}], y: '' });
});

