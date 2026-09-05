import assert from 'node:assert/strict';
import test from 'node:test';
import { wrapText } from './textLayout.ts';
const measure = (text: string) => Array.from(text).length;
test('text wraps on word boundaries and preserves explicit blank lines', () => {
  assert.deepEqual(wrapText('hello world\n\nnext', 7, measure), ['hello', 'world', '', 'next']);
});
test('unbroken words wrap without losing text or splitting surrogate pairs', () => {
  assert.deepEqual(wrapText('abcdef😀xyz', 4, measure), ['abcd', 'ef😀x', 'yz']);
});
test('text normalizes line endings and keeps empty text valid', () => {
  assert.deepEqual(wrapText('a\r\nb\rc', 10, measure), ['a', 'b', 'c']);
  assert.deepEqual(wrapText('', 10, measure), ['']);
});
