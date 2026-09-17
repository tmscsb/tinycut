import assert from "node:assert/strict";
import test from "node:test";
import {
  addPadding,
  expansionForScroll,
  needsExpansion,
  paddingCss,
} from "./canvasExpansion.ts";

const view = {
  scrollWidth: 3000,
  scrollHeight: 4000,
  clientWidth: 800,
  clientHeight: 600,
};

test("does not expand when the viewport sits well inside the pasteboard", () => {
  const delta = expansionForScroll({
    ...view,
    scrollLeft: 900,
    scrollTop: 1100,
  });
  assert.equal(needsExpansion(delta), false);
});

test("grows only the side the viewport is approaching", () => {
  assert.deepEqual(
    expansionForScroll({ ...view, scrollLeft: 80, scrollTop: 1100 }, 240, 800),
    { top: 0, right: 0, bottom: 0, left: 800 },
  );
  assert.deepEqual(
    expansionForScroll({ ...view, scrollLeft: 900, scrollTop: 40 }, 240, 800),
    { top: 800, right: 0, bottom: 0, left: 0 },
  );
  assert.deepEqual(
    expansionForScroll({ ...view, scrollLeft: 2100, scrollTop: 1100 }, 240, 800),
    { top: 0, right: 800, bottom: 0, left: 0 },
  );
  assert.deepEqual(
    expansionForScroll({ ...view, scrollLeft: 900, scrollTop: 3300 }, 240, 800),
    { top: 0, right: 0, bottom: 800, left: 0 },
  );
});

test("can grow two adjacent sides together without touching the others", () => {
  assert.deepEqual(
    expansionForScroll({ ...view, scrollLeft: 10, scrollTop: 10 }, 240, 800),
    { top: 800, right: 0, bottom: 0, left: 800 },
  );
});

test("adds padding and formats it as a CSS shorthand", () => {
  const next = addPadding(
    { top: 1000, right: 1000, bottom: 1000, left: 1000 },
    { top: 0, right: 800, bottom: 0, left: 0 },
  );
  assert.deepEqual(next, { top: 1000, right: 1800, bottom: 1000, left: 1000 });
  assert.equal(paddingCss(next), "1000px 1800px 1000px 1000px");
});
