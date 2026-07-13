import assert from "node:assert/strict";
import test from "node:test";
import { getPngExportDimensions } from "./exportPng.ts";

const a4 = { widthMm: 210, heightMm: 297 };

test("reports exact physical PNG dimensions", () => {
  assert.deepEqual(getPngExportDimensions(a4, 300), {
    widthPx: 2480,
    heightPx: 3508,
    pixelCount: 8_699_840,
    supported: true,
  });
});

test("rejects unsafe canvas allocations before rendering", () => {
  assert.equal(getPngExportDimensions(a4, 600).supported, true);
  assert.equal(getPngExportDimensions(a4, 1200).supported, false);
  assert.equal(getPngExportDimensions({ widthMm: 2_000, heightMm: 2_000 }, 300).supported, false);
});
