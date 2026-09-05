import assert from "node:assert/strict";
import test from "node:test";
import {
  getMagneticCardinalRotation,
  pointerAngleDegrees,
  shortestAngleDelta,
  snapRotationDegrees,
} from "./rotationGeometry.ts";

test("measures pointer angles clockwise in screen coordinates", () => {
  assert.equal(pointerAngleDegrees(10, 10, 20, 10), 0);
  assert.equal(pointerAngleDegrees(10, 10, 10, 20), 90);
  assert.equal(pointerAngleDegrees(10, 10, 0, 10), 180);
  assert.equal(pointerAngleDegrees(10, 10, 10, 0), -90);
});

test("uses the shortest delta when crossing the angle seam", () => {
  assert.equal(shortestAngleDelta(179, -179), 2);
  assert.equal(shortestAngleDelta(-179, 179), -2);
});

test("snaps rotation to fifteen-degree increments", () => {
  assert.equal(snapRotationDegrees(22), 15);
  assert.equal(snapRotationDegrees(23), 30);
  assert.equal(snapRotationDegrees(-8), -15);
});

test("leaves rotation unchanged for an invalid snap step", () => {
  assert.equal(snapRotationDegrees(12.5, 0), 12.5);
});

test("magnetically acquires cardinal angles within four degrees", () => {
  assert.deepEqual(getMagneticCardinalRotation(87, null), {
    degrees: 90,
    lockedCardinal: 90,
  });
  assert.deepEqual(getMagneticCardinalRotation(-2, null), {
    degrees: 0,
    lockedCardinal: 0,
  });
  assert.deepEqual(getMagneticCardinalRotation(275, null), {
    degrees: 275,
    lockedCardinal: null,
  });
});

test("holds a cardinal lock until the pointer moves beyond eight degrees", () => {
  assert.deepEqual(getMagneticCardinalRotation(97, 90), {
    degrees: 90,
    lockedCardinal: 90,
  });
  assert.deepEqual(getMagneticCardinalRotation(99, 90), {
    degrees: 99,
    lockedCardinal: null,
  });
});
