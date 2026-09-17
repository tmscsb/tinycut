import assert from "node:assert/strict";
import test from "node:test";
import type { DocumentState } from "../types/document.ts";
import { exportDocumentAsSvg } from "./exportSvg.ts";
import { printSurfaceInnerHtml, stripXmlDeclaration } from "./printDocument.ts";

const state = {
  version: 2,
  id: "test-doc-1",
  name: "Untitled",
  page: { templateId: "a4-portrait", name: "A4 Portrait", widthMm: 210, heightMm: 297 },
  items: [{
    id: "image-1",
    type: "image",
    name: "Sample",
    src: "data:image/png;base64,AAAA",
    xMm: 10,
    yMm: 20,
    widthMm: 80,
    heightMm: 80,
    naturalWidthPx: 100,
    naturalHeightPx: 100,
    rotationDeg: 0,
    lockedAspectRatio: true,
    crop: { left: 0, top: 0, right: 1, bottom: 1 },
  }],
  selectedItemId: null,
  selectedItemIds: [],
  zoom: 0.5,
  unit: "mm",
  gridSizeMm: 5,
  showGrid: false,
  snapToGrid: false,
  showGuides: false,
  cropModeItemId: null,
  dirty: false,
} satisfies DocumentState;

test("print markup is the page SVG without an XML declaration", () => {
  const svg = exportDocumentAsSvg(state);
  const markup = printSurfaceInnerHtml(state);
  assert.match(svg, /^<\?xml /);
  assert.equal(markup, stripXmlDeclaration(svg));
  assert.match(markup, /^<svg\b/);
  assert.doesNotMatch(markup, /<\?xml/);
});

test("print SVG uses physical millimetres and clips to the page", () => {
  const svg = exportDocumentAsSvg(state);
  assert.match(svg, /width="210mm"/);
  assert.match(svg, /height="297mm"/);
  assert.match(svg, /viewBox="0 0 210 297"/);
  assert.match(svg, /overflow="hidden"/);
  assert.match(svg, /x="10"/);
  assert.match(svg, /width="80"/);
});

test("raster SVG can be sized in target pixels without changing the viewBox", () => {
  const svg = exportDocumentAsSvg(state, { width: "2480px", height: "3508px" });
  assert.match(svg, /width="2480px"/);
  assert.match(svg, /height="3508px"/);
  assert.match(svg, /viewBox="0 0 210 297"/);
});
