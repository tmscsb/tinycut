import assert from "node:assert/strict";
import test from "node:test";
import type { DocumentState, ImageItem } from "../types/document.ts";
import {
  applyCropToImageFrame,
  getImageCropTransformOrigin,
  getImageSourceFrame,
  migrateLegacyCropGeometry,
  normalizeCrop,
  screenDeltaToLocalCropPercent,
} from "./cropGeometry.ts";
import { exportDocumentAsSvg } from "./exportSvg.ts";

function image(overrides: Partial<ImageItem> = {}): ImageItem {
  return {
    id: "image-1",
    type: "image",
    name: "sample.png",
    src: "data:image/png;base64,AA==",
    xMm: 10,
    yMm: 20,
    widthMm: 100,
    heightMm: 50,
    naturalWidthPx: 1000,
    naturalHeightPx: 500,
    rotationDeg: 0,
    lockedAspectRatio: true,
    crop: { left: 0, top: 0, right: 1, bottom: 1 },
    ...overrides,
  };
}

test("normalizes invalid and inverted crop bounds", () => {
  assert.deepEqual(
    normalizeCrop({ left: -1, top: 2, right: 0, bottom: 0 }),
    { left: 0, top: 0.99, right: 0.01, bottom: 1 },
  );
});

test("crop updates visible geometry while retaining a stable source frame", () => {
  const original = image();
  const first = { ...original, ...applyCropToImageFrame(original, { left: 0.25, top: 0.2, right: 0.75, bottom: 0.8 }) };
  assert.deepEqual(
    { xMm: first.xMm, yMm: first.yMm, widthMm: first.widthMm, heightMm: first.heightMm },
    { xMm: 35, yMm: 30, widthMm: 50, heightMm: 30.000000000000004 },
  );
  assert.deepEqual(getImageSourceFrame(first), { xMm: 10, yMm: 20, widthMm: 100, heightMm: 50 });

  const second = { ...first, ...applyCropToImageFrame(first, { left: 0.5, top: 0, right: 1, bottom: 1 }) };
  assert.deepEqual(getImageSourceFrame(second), { xMm: 10, yMm: 20, widthMm: 100, heightMm: 50 });
  assert.equal(second.xMm, 60);
  assert.equal(second.widthMm, 50);

  const reset = { ...second, ...applyCropToImageFrame(second, { left: 0, top: 0, right: 1, bottom: 1 }) };
  assert.deepEqual(
    { xMm: reset.xMm, yMm: reset.yMm, widthMm: reset.widthMm, heightMm: reset.heightMm },
    { xMm: 10, yMm: 20, widthMm: 100, heightMm: 50 },
  );
});

test("crop mode transform origin matches the visible crop center", () => {
  const cropped = image({
    xMm: 35,
    yMm: 30,
    widthMm: 50,
    heightMm: 30,
    crop: { left: 0.25, top: 0.2, right: 0.75, bottom: 0.8 },
    rotationDeg: 37.5,
  });

  const source = getImageSourceFrame(cropped);
  assert.equal(source.xMm, 10);
  assert.equal(source.yMm, 20);
  assert.equal(source.widthMm, 100);
  assert.ok(Math.abs(source.heightMm - 50) < 1e-12);
  assert.deepEqual(getImageCropTransformOrigin(cropped), { xMm: 50, yMm: 25 });
});

test("screen drag deltas are converted into rotated image crop axes", () => {
  assert.deepEqual(screenDeltaToLocalCropPercent(10, 0, 0, 100, 50), { dxPercent: 0.1, dyPercent: 0 });

  const rotated = screenDeltaToLocalCropPercent(0, 10, 90, 100, 50);
  assert.ok(Math.abs(rotated.dxPercent - 0.1) < 1e-12);
  assert.ok(Math.abs(rotated.dyPercent) < 1e-12);

  const localY = screenDeltaToLocalCropPercent(-10, 0, 90, 100, 50);
  assert.ok(Math.abs(localY.dxPercent) < 1e-12);
  assert.ok(Math.abs(localY.dyPercent - 0.2) < 1e-12);
});

test("migrates legacy pre-crop dimensions to visible dimensions", () => {
  const migrated = migrateLegacyCropGeometry(image({ crop: { left: 0.1, top: 0.2, right: 0.9, bottom: 0.8 } }));
  assert.equal(migrated.xMm, 20);
  assert.equal(migrated.yMm, 30);
  assert.equal(migrated.widthMm, 80);
  assert.equal(migrated.heightMm, 30.000000000000004);
});

test("SVG export uses the visible crop frame exactly once", () => {
  const cropped = image({ xMm: 35, yMm: 30, widthMm: 50, heightMm: 30, crop: { left: 0.25, top: 0.2, right: 0.75, bottom: 0.8 } });
  const state = {
    version: 2,
    page: { templateId: "custom", name: "Custom", widthMm: 210, heightMm: 297 },
    items: [cropped],
    selectedItemId: null,
    selectedItemIds: [],
    zoom: 1,
    unit: "mm",
    gridSizeMm: 5,
    showGrid: false,
    snapToGrid: false,
    showGuides: true,
    cropModeItemId: null,
    dirty: false,
  } satisfies DocumentState;
  const svg = exportDocumentAsSvg(state);
  assert.match(svg, /x="35"/);
  assert.match(svg, /y="30"/);
  assert.match(svg, /width="50"/);
  assert.match(svg, /height="30"/);
  assert.match(svg, /<clipPath id="clip-0-image-1">/);
  assert.match(svg, /<rect x="35" y="30" width="50" height="30"/);
  assert.match(svg, /<image[\s\S]*x="10"[\s\S]*y="20"[\s\S]*width="100"[\s\S]*clip-path="url\(#clip-0-image-1\)"/);
  assert.equal(svg.match(/<image\s/g)?.length, 1);
});

test("SVG export includes every image in document layer order", () => {
  const state = {
    version: 2,
    page: { templateId: "custom", name: "Custom", widthMm: 100, heightMm: 100 },
    items: [
      image({ id: "back", name: "Back & base", src: "data:image/png;base64,AAAA" }),
      image({ id: "front", name: "Front", src: "data:image/jpeg;base64,BBBB" }),
    ],
    selectedItemId: "back",
    selectedItemIds: ["back"],
    zoom: 1,
    unit: "mm",
    gridSizeMm: 5,
    showGrid: false,
    snapToGrid: false,
    showGuides: false,
    cropModeItemId: null,
    dirty: false,
  } satisfies DocumentState;

  const svg = exportDocumentAsSvg(state);
  assert.equal(svg.match(/<image\s/g)?.length, 2);
  assert.ok(svg.indexOf('id="layer-0-back"') < svg.indexOf('id="layer-1-front"'));
  assert.match(svg, /inkscape:label="Back &amp; base"/);
  assert.match(svg, /xlink:href="data:image\/jpeg;base64,BBBB"/);
});

test("SVG export preserves rotation and escapes text", () => {
  const state = {
    version: 2,
    page: { templateId: "custom", name: "Custom", widthMm: 100, heightMm: 100 },
    items: [{
      id: "text-1",
      type: "text",
      name: "Text 1",
      text: "A < B & C",
      xMm: 10,
      yMm: 20,
      widthMm: 40,
      heightMm: 10,
      rotationDeg: 45,
      lockedAspectRatio: false,
      fontSizeMm: 5,
      fontFamily: "Arial, sans-serif",
      fontWeight: "400",
      textAlign: "left",
      color: "#000000",
    }],
    selectedItemId: null,
    selectedItemIds: [],
    zoom: 1,
    unit: "mm",
    gridSizeMm: 5,
    showGrid: false,
    snapToGrid: false,
    showGuides: false,
    cropModeItemId: null,
    dirty: false,
  } satisfies DocumentState;
  const svg = exportDocumentAsSvg(state);
  assert.match(svg, /transform="rotate\(45 30 25\)"/);
  assert.match(svg, /A &lt; B &amp; C/);
});
