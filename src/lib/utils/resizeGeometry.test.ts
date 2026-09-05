import assert from "node:assert/strict";
import test from "node:test";
import {
  getGroupCenteringDelta,
  getRotatedResizeCursor,
  resizeFrameFromScreenDelta,
  screenDeltaToLocal,
} from "./resizeGeometry.ts";

const start = { xMm: 10, yMm: 20, widthMm: 100, heightMm: 50 };

test("rotates resize cursors to the item's nearest screen direction", () => {
  assert.equal(getRotatedResizeCursor("n", 0), "n-resize");
  assert.equal(getRotatedResizeCursor("n", 45), "ne-resize");
  assert.equal(getRotatedResizeCursor("e", 90), "s-resize");
  assert.equal(getRotatedResizeCursor("nw", -45), "w-resize");
  assert.equal(getRotatedResizeCursor("n", 22), "n-resize");
  assert.equal(getRotatedResizeCursor("n", 23), "ne-resize");
});

test("converts screen deltas to the local axes of a rotated item", () => {
  const local = screenDeltaToLocal(0, 10, 90);
  assert.ok(Math.abs(local.dx - 10) < 1e-12);
  assert.ok(Math.abs(local.dy) < 1e-12);
});

test("resizes an unrotated frame from its west edge", () => {
  assert.deepEqual(
    resizeFrameFromScreenDelta(start, "w", 20, 0, {
      lockedAspectRatio: false,
      minSizeMm: 1,
      rotationDeg: 0,
    }),
    { xMm: 30, yMm: 20, widthMm: 80, heightMm: 50 },
  );
});

test("keeps the opposite world-space anchor fixed while resizing a rotated item", () => {
  const next = resizeFrameFromScreenDelta(start, "e", 0, 20, {
    lockedAspectRatio: false,
    minSizeMm: 1,
    rotationDeg: 90,
  });
  assert.ok(Math.abs(next.widthMm - 120) < 1e-12);
  assert.ok(Math.abs(next.heightMm - 50) < 1e-12);
  assert.ok(Math.abs(next.xMm) < 1e-12);
  assert.ok(Math.abs(next.yMm - 30) < 1e-12);
});

test("preserves aspect ratio and the opposite corner", () => {
  const next = resizeFrameFromScreenDelta(start, "se", 20, 5, {
    lockedAspectRatio: true,
    minSizeMm: 1,
    rotationDeg: 0,
  });
  assert.equal(next.widthMm / next.heightMm, 2);
  assert.deepEqual(next, { xMm: 10, yMm: 20, widthMm: 120, heightMm: 60 });
});

test("snaps unlocked dimensions without going below the minimum", () => {
  const next = resizeFrameFromScreenDelta(start, "nw", 97, 47, {
    lockedAspectRatio: false,
    minSizeMm: 1,
    rotationDeg: 0,
    snapStepMm: 5,
  });
  assert.equal(next.widthMm, 5);
  assert.equal(next.heightMm, 5);
  assert.equal(next.xMm, 105);
  assert.equal(next.yMm, 65);
});

test("keeps the aspect ratio when a locked handle reaches minimum size", () => {
  const next = resizeFrameFromScreenDelta(start, "se", -500, -500, {
    lockedAspectRatio: true,
    minSizeMm: 1,
    rotationDeg: 0,
  });
  assert.equal(next.widthMm, 2);
  assert.equal(next.heightMm, 1);
  assert.equal(next.widthMm / next.heightMm, 2);
});

test("centers a group without collapsing its internal layout", () => {
  const frames = [
    { xMm: 10, yMm: 20, widthMm: 20, heightMm: 10 },
    { xMm: 40, yMm: 50, widthMm: 30, heightMm: 20 },
  ];
  const delta = getGroupCenteringDelta(frames, 100, 100);
  assert.deepEqual(delta, { dxMm: 10, dyMm: 5 });
  assert.equal((frames[1].xMm + delta.dxMm) - (frames[0].xMm + delta.dxMm), 30);
  assert.equal((frames[1].yMm + delta.dyMm) - (frames[0].yMm + delta.dyMm), 30);
});

test('centering a mixed-rotation group uses the visible bounds', () => {
  const delta = getGroupCenteringDelta([
    { xMm: 0, yMm: 0, widthMm: 100, heightMm: 10, rotationDeg: 90 },
    { xMm: 100, yMm: 0, widthMm: 20, heightMm: 10, rotationDeg: 0 },
  ], 200, 200);
  assert.ok(Math.abs(delta.dxMm - 17.5) < 1e-10);
  assert.ok(Math.abs(delta.dyMm - 95) < 1e-10);
});
