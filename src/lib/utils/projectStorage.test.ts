import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import type { DocumentState, ImageItem } from "../types/document.ts";
import { LOCAL_STORAGE_KEY } from "../types/document.ts";
import { getAsset, hasAsset, hashBlob, registerAsset } from "./assets.ts";
import {
  collectUnusedAssets,
  createMemoryBackend,
  deleteStoredProject,
  listStoredProjects,
  migrateLegacyLocalStorage,
  readStoredProject,
  setProjectBackend,
  writeStoredProject,
  type StorageBackend,
} from "./projectStorage.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
let backend: StorageBackend;

beforeEach(() => {
  backend = createMemoryBackend();
  setProjectBackend(backend);
});

function imageItem(id: string, assetId: string): ImageItem {
  return {
    id,
    type: "image",
    name: "Swatch",
    assetId,
    xMm: 10,
    yMm: 20,
    widthMm: 40,
    heightMm: 30,
    naturalWidthPx: 80,
    naturalHeightPx: 60,
    rotationDeg: 0,
    lockedAspectRatio: true,
    crop: { left: 0, top: 0, right: 1, bottom: 1 },
    borderWidthMm: 0,
    borderColor: "#000000",
  };
}

function sampleDoc(overrides: Partial<DocumentState> = {}): DocumentState {
  return {
    version: 2,
    id: "test-doc-1",
    name: "Felt pieces",
    page: { templateId: "a4-portrait", name: "A4 Portrait", widthMm: 210, heightMm: 297 },
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
    dirty: true,
    ...overrides,
  };
}

async function text(path: string): Promise<string> {
  const file = await backend.readFile(path);
  assert.ok(file, `${path} exists`);
  return file.text();
}

test("an image used by several items and layouts is stored once, outside the JSON", async () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  const asset = await registerAsset(new Blob([bytes]), "image/png");
  const items = [imageItem("a", asset.id), imageItem("b", asset.id)];
  const meta = await writeStoredProject(sampleDoc({ items }));
  await writeStoredProject(sampleDoc({ id: "test-doc-2", items: [imageItem("c", asset.id)] }));

  const json = await text("projects/test-doc-1/project.json");
  assert.doesNotMatch(json, /base64/);
  assert.deepEqual((await backend.list("assets")).map((entry) => entry.name), [asset.id]);
  const stored = await backend.readFile(`assets/${asset.id}`);
  assert.deepEqual(new Uint8Array(await stored!.arrayBuffer()), bytes);
  assert.deepEqual(
    { itemCount: meta.itemCount, imageCount: meta.imageCount, imageBytes: meta.imageBytes, pageName: meta.pageName },
    { itemCount: 2, imageCount: 2, imageBytes: 7, pageName: "A4 Portrait" },
  );
});

test("opening a layout loads its images from browser storage", async () => {
  const bytes = new Uint8Array([9, 8, 7, 6, 5, Math.floor(Math.random() * 255)]);
  const assetId = await hashBlob(new Blob([bytes]));
  assert.equal(hasAsset(assetId), false);
  await backend.writeFile(`assets/${assetId}`, new Blob([bytes]));
  await backend.writeFile("projects/test-doc-3/project.json", new Blob([JSON.stringify({
    storage: 2,
    name: "From disk",
    updatedAt: 1234,
    assets: { [assetId]: { mime: "image/webp", size: bytes.length } },
    document: { version: 2, page: sampleDoc().page, items: [imageItem("disk", assetId)] },
  })]));

  const loaded = await readStoredProject("test-doc-3");
  assert.equal(loaded.document.name, "From disk");
  assert.equal(loaded.meta.updatedAt, 1234);
  assert.equal(loaded.missingImages, 0);
  assert.equal(getAsset(assetId)?.mime, "image/webp");
  assert.deepEqual(new Uint8Array(await getAsset(assetId)!.blob.arrayBuffer()), bytes);
});

test("a layout whose image file is gone still opens and reports it", async () => {
  const assetId = "e".repeat(64);
  await backend.writeFile("projects/test-doc-4/project.json", new Blob([JSON.stringify({
    storage: 2,
    name: "Broken",
    assets: { [assetId]: { mime: "image/png", size: 3 } },
    document: { version: 2, page: sampleDoc().page, items: [imageItem("gone", assetId)] },
  })]));
  const loaded = await readStoredProject("test-doc-4");
  assert.equal(loaded.document.items.length, 1);
  assert.equal(loaded.missingImages, 1);
});

test("layouts saved by the previous format move their images into shared storage", async () => {
  const bytes = new Uint8Array([1, 1, 2, 3, 5, 8, 13]);
  await backend.writeFile("projects/test-doc-5/images/old_png.png", new Blob([bytes]));
  const { assetId: _assetId, ...legacyItem } = imageItem("old", "");
  await backend.writeFile("projects/test-doc-5/project.json", new Blob([JSON.stringify({
    storage: 1,
    id: "test-doc-5",
    name: "Old save",
    updatedAt: 99,
    document: { version: 2, page: sampleDoc().page, items: [{ ...legacyItem, asset: "old_png.png", assetMime: "image/png" }] },
  })]));

  const loaded = await readStoredProject("test-doc-5");
  const expectedId = await hashBlob(new Blob([bytes]));
  assert.equal((loaded.document.items[0] as ImageItem).assetId, expectedId);
  assert.equal(loaded.meta.updatedAt, 99);
  assert.deepEqual(await backend.list("projects/test-doc-5/images"), []);
  assert.ok(await backend.readFile(`assets/${expectedId}`));
  assert.equal(JSON.parse(await text("projects/test-doc-5/project.json")).storage, 2);
});

test("listing, deleting, and cleanup keep only images something still uses", async () => {
  const kept = await registerAsset(new Blob([new Uint8Array([1, 2, 3, 4])]), "image/png");
  const dropped = await registerAsset(new Blob([new Uint8Array([4, 3, 2, 1])]), "image/png");
  const protectedByTab = await registerAsset(new Blob([new Uint8Array([7, 7, 7])]), "image/png");
  await writeStoredProject(sampleDoc({ id: "keep-layout", name: "Keep", items: [imageItem("k", kept.id)] }));
  await writeStoredProject(sampleDoc({ id: "drop-layout", name: "Drop", items: [imageItem("d", dropped.id), imageItem("p", protectedByTab.id)] }));
  assert.deepEqual((await listStoredProjects()).map((project) => project.name).sort(), ["Drop", "Keep"]);

  await deleteStoredProject("drop-layout");
  assert.deepEqual((await listStoredProjects()).map((project) => project.id), ["keep-layout"]);

  assert.equal(await collectUnusedAssets(new Set(), Date.now()), 0, "recent files survive, another tab may be using them");
  assert.equal(await collectUnusedAssets(new Set([protectedByTab.id]), Date.now() + 2 * DAY_MS), 1);
  const remaining = (await backend.list("assets")).map((entry) => entry.name).sort();
  assert.deepEqual(remaining, [kept.id, protectedByTab.id].sort());
});

test("cleanup deletes nothing when a saved layout cannot be read", async () => {
  const orphan = await registerAsset(new Blob([new Uint8Array([6, 6, 6, 6])]), "image/png");
  await backend.writeFile(`assets/${orphan.id}`, orphan.blob);
  await backend.writeFile("projects/corrupt-layout/project.json", new Blob(["{not json"]));
  await assert.rejects(collectUnusedAssets(new Set(), Date.now() + 2 * DAY_MS));
  assert.ok(await backend.readFile(`assets/${orphan.id}`));
});

test("a localStorage project is moved into browser files once", async () => {
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
    items: [{ ...imageItem("legacy", ""), assetId: undefined, src: "data:image/png;base64,AQID" }],
  }));
  const migrated = await migrateLegacyLocalStorage();
  assert.ok(migrated);
  assert.equal(migrated.name, "Recovered layout");
  assert.equal(migrated.imageCount, 1);
  assert.equal(storage.has(LOCAL_STORAGE_KEY), false);
  assert.equal((await listStoredProjects()).length, 1);
  assert.equal((await backend.list("assets")).length, 1);
  assert.equal(await migrateLegacyLocalStorage(), null);
});
