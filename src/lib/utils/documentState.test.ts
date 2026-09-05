import assert from "node:assert/strict";
import test from "node:test";
import type { DocumentState } from "../types/document.ts";
import {
  getDocumentContentSnapshot,
  normalizeDocument,
  serializeDocument,
} from "./documentState.ts";

const base: DocumentState = {
  version: 2,
  page: { templateId: "custom", name: "Custom", widthMm: 100, heightMm: 100 },
  items: [],
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
};

test("normalizes imported items and makes duplicate ids unique", () => {
  const normalized = normalizeDocument({
    ...base,
    items: [
      {
        id: "same",
        type: "shape",
        shapeType: "rect",
        name: "Rectangle",
        xMm: 0,
        yMm: 0,
        widthMm: 0,
        heightMm: 10,
        rotationDeg: -90,
        fill: "not-a-color",
        stroke: "#000000",
        strokeWidthMm: 100,
        cornerRadiusMm: 100,
      },
      {
        id: "same",
        type: "text",
        name: "Text",
        text: "Hello",
        xMm: 0,
        yMm: 0,
        widthMm: 20,
        heightMm: 10,
        rotationDeg: 0,
        fontSizeMm: 5,
        fontFamily: "unsafe; position: fixed",
        fontWeight: "900",
        textAlign: "justify",
        color: "red",
      },
    ],
  });
  assert.equal(normalized.items[0].id, "same");
  assert.equal(normalized.items[1].id, "same-2");
  assert.equal(normalized.items[0].widthMm, 1);
  assert.equal(normalized.items[0].rotationDeg, 270);
  assert.equal(normalized.items[0].type === "shape" && normalized.items[0].fill, "#3b82f6");
  assert.equal(normalized.items[1].type === "text" && normalized.items[1].fontFamily, "Arial, sans-serif");
});

test("rejects invalid image sources and dimensions", () => {
  assert.throws(() => normalizeDocument({
    ...base,
    items: [{
      id: "image",
      type: "image",
      name: "Broken",
      src: "",
      xMm: 0,
      yMm: 0,
      widthMm: 10,
      heightMm: 10,
      naturalWidthPx: 100,
      naturalHeightPx: 100,
    }],
  }));
  assert.throws(() => normalizeDocument({
    ...base,
    items: [{
      id: "image",
      type: "image",
      name: "Remote",
      src: "https://example.com/image.png",
      xMm: 0,
      yMm: 0,
      widthMm: 10,
      heightMm: 10,
      naturalWidthPx: 100,
      naturalHeightPx: 100,
    }],
  }));
});

test("content snapshots ignore view and selection state", () => {
  const changedView = {
    ...base,
    zoom: 2,
    unit: "cm" as const,
    selectedItemId: "missing",
    selectedItemIds: ["missing"],
  };
  assert.equal(getDocumentContentSnapshot(base), getDocumentContentSnapshot(changedView));
});

test("serialized projects do not persist transient editor state", () => {
  const serialized = JSON.parse(serializeDocument({
    ...base,
    selectedItemId: "item",
    selectedItemIds: ["item"],
    cropModeItemId: "item",
    dirty: true,
  })) as DocumentState;
  assert.equal(serialized.selectedItemId, null);
  assert.deepEqual(serialized.selectedItemIds, []);
  assert.equal(serialized.cropModeItemId, null);
  assert.equal(serialized.dirty, false);
});

test('unknown project versions and oversized paper are rejected', () => {
  assert.throws(() => normalizeDocument({...base,version:99}), /unsupported version/);
  assert.throws(() => normalizeDocument({...base,page:{...base.page,widthMm:1e100}}), /2,000 mm/);
});

test('unknown and mismatched template IDs become custom paper', () => {
  assert.equal(normalizeDocument({...base,page:{...base.page,templateId:'a4-portrait'}}).page.templateId, 'custom');
  assert.equal(normalizeDocument({...base,page:{...base.page,templateId:'missing'}}).page.templateId, 'custom');
});
