import assert from 'node:assert/strict';
import test from 'node:test';
import { setPngDensity } from './pngMetadata.ts';
// A real 1x1 PNG; verify density replacement without changing image payload.
const original = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=', 'base64'));
test('PNG metadata records the selected physical print density', () => {
  const png = setPngDensity(original, 600);
  const typeIndex = Buffer.from(png).indexOf('pHYs');
  const view = new DataView(png.buffer);
  assert.equal(view.getUint32(typeIndex + 4), 23622);
  assert.equal(view.getUint32(typeIndex + 8), 23622);
  assert.equal(png[typeIndex + 12], 1);
  assert.equal(png.length, original.length + 21);
  assert.deepEqual(setPngDensity(png, 600), png);
  const replaced = setPngDensity(png, 300);
  assert.equal(replaced.length, png.length);
  assert.equal(new DataView(replaced.buffer).getUint32(typeIndex + 4), 11811);
});
test('PNG metadata rejects corrupt input and invalid density', () => {
  assert.throws(() => setPngDensity(new Uint8Array(8), 300));
  assert.throws(() => setPngDensity(original, NaN));
  assert.throws(() => setPngDensity(original.slice(0, 20), 300));
});
