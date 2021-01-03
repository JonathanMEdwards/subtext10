import { compile } from './exports';
const NaN = Number.NaN;

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

test('convert number to text', () => {
  let w = compile(`
  a:: 0
  as:: array{0}
  `);
  w.createAt('as')
  w.editAt('a', `::convert ''`)
  w.editAt('as.0', `::convert ''`);
  expect(w.dump()).toEqual({ a: '0', as: ['0'] });
});

test('convert text to number', () => {
  let w = compile(`
  a:: '0'
  as:: array{'0'}
  `);
  w.createAt('as')
  w.editAt('a', `::convert 0`)
  w.editAt('as.0', `::convert 0`);
  expect(w.dump()).toEqual({ a: 0, as: [0] });
});

test('conversion error', () => {
  let w = compile(`
  a:: 'a'
  as:: array{'a'}
  `);
  w.createAt('as')
  w.editAt('a', `::convert 0`)
  expect(w.editErrorMessages).toContain('a: conversion');
  w.editAt('as.0', `::convert 0`);
  expect(w.dump()).toEqual({ a: NaN, as: [NaN] });
  expect(w.editErrorMessages).toContain('a: conversion');
  expect(w.editErrorMessages).toContain('as.0: conversion');
  expect(w.editErrorMessages).toContain('as.1: conversion');
});

test('write resets conversion error', () => {
  let w = compile(`a:: 'a'`);
  w.editAt('a', `::convert 0`)
  expect(w.dump()).toEqual({ a: NaN });
  w.writeAt('a', 1)
  expect(w.dump()).toEqual({ a: 1 });
  expect(w.editErrorMessages).toEqual([]);
});

test('conversion type error', () => {
  let w = compile(`a:: 0, b = a + 1`);
  w.editAt('a', `::convert ''`)
  expect(w.editErrorMessages).toContain('b: type');
  w.editAt('a', `::convert 0`)
  expect(w.editErrorMessages).toEqual([]);
  expect(w.dump()).toEqual({ a: 0, b: 1 });
});

test('reference error', () => {
  let w = compile(`a:: record{x: 0}, b = a.x`);
  w.editAt('a', `::convert 0`)
  expect(w.editErrorMessages).toContain('b: reference');
  expect(w.dump()).toEqual({ a: 0, b: null });
});

