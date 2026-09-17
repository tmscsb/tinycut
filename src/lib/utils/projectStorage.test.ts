import assert from "node:assert/strict";
import test from "node:test";
import type { DocumentState, ImageItem } from "../types/document.ts";
import { LOCAL_STORAGE_KEY } from "../types/document.ts";
import {
  bytesToDataUrl,
  createMemoryBackend,
  deleteStoredProject,
  listStoredProjects,
  migrateLegacyLocalStorage,
  packProject,
  parseImageDataUrl,
  readStoredProject,
  setProjectBackend,
  unpackProject,
  writeStoredProject,
} from "./projectStorage.ts";

const png = bytesToDataUrl("image/png", new Uint8Array([137, 80, 78, 71]));

function sampleDoc(overrides: Partial<DocumentState> = {}): DocumentState {
  return {
    version: 2,
    id: "test-doc-1",
    name: "Felt pieces",
    page: { templateId: "a4-portrait", name: "A4 Portrait", widthMm: 210, heightMm: 297 },
    items: [{
      id: "image-1",
      type: "image",
      name: "Swatch",
      src: png,
      xMm: 10,
      yMm: 20,
      widthMm: 40,
      heightMm: 30,
      naturalWidthPx: 80,
      naturalHeightPx: 60,
      rotationDeg: 0,
      lockedAspectRatio: true,
      crop: { left: 0, top: 0, right: 1, bottom: 1 },
    }],
    selectedItemId: "image-1",
    selectedItemIds: ["image-1"],
    zoom: 1,
    unit: "mm",
    gridSizeMm: 5,
    showGrid: false,
    snapToGrid: false,
    showGuides: false,
    cropModeItemId: null,
    dirty: true,
    ...overrides,
  };
}

test("pack and unpack keep image bytes out of the JSON", () => {
  const packed = packProject(sampleDoc());
  assert.equal(packed.assets.length, 1);
  assert.doesNotMatch(packed.json, /data:image\/png;base64,/);
  const restored = unpackProject(packed.json, (name) => packed.assets.find((asset) => asset.filename === name)?.bytes ?? null);
  const image = restored.items[0] as ImageItem;
  assert.equal(image.type, "image");
  assert.deepEqual(parseImageDataUrl(image.src)?.bytes, packed.assets[0].bytes);
  assert.equal(restored.id, "test-doc-1");
  assert.equal(restored.name, "Felt pieces");
  assert.equal(restored.selectedItemId, null);
});

test("memory storage lists, loads, and deletes layouts", async () => {
  setProjectBackend(createMemoryBackend());
  const first = sampleDoc();
  const second = sampleDoc({ id: "test-doc-2", name: "Second", items: [] });
  await writeStoredProject(first);
  await writeStoredProject(second);
  const listed = await listStoredProjects();
  assert.deepEqual(listed.map((project) => project.id).sort(), ["test-doc-1", "test-doc-2"]);
  const loaded = await readStoredProject("test-doc-1");
  assert.equal(loaded.items[0]?.type, "image");
  assert.equal((loaded.items[0] as ImageItem).src.startsWith("data:image/png;base64,"), true);
  await deleteStoredProject("test-doc-1");
  assert.deepEqual((await listStoredProjects()).map((project) => project.id), ["test-doc-2"]);
});

test("a localStorage project is moved into browser files once", async () => {
  setProjectBackend(createMemoryBackend());
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  storage.set(LOCAL_STORAGE_KEY, JSON.stringify({
    version: 2,
    page: { templateId: "a4-portrait", name: "A4 Portrait", widthMm: 210, heightMm: 297 },
    items: [],
  }));
  const migrated = await migrateLegacyLocalStorage();
  assert.ok(migrated);
  assert.equal(migrated.name, "Recovered layout");
  assert.equal(storage.has(LOCAL_STORAGE_KEY), false);
  assert.equal((await listStoredProjects()).length, 1);
  assert.equal(await migrateLegacyLocalStorage(), null);
});
