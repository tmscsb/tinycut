import {
  type DocumentState,
  type DocumentItem,
  type ImageItem,
  type ShapeItem,
  type ShapeType,
  type TextItem,
  type ImageCrop,
  type Unit,
  PAGE_TEMPLATES,
  MIN_SIZE_MM,
  MAX_PAGE_SIZE_MM,
  MAX_PROJECT_FILE_BYTES,
  MAX_DOCUMENT_ITEMS,
} from "../types/document.ts";
import { createId, createProjectId } from "../utils/ids.ts";
import { loadImageFile } from "../utils/image.ts";
import { confirmAction, showNotice, requestFitPage, showOpenProjects } from "./uiStore.svelte.ts";
import {
  collectUnusedAssets,
  deleteStoredProject,
  listStoredProjects,
  loadStoredAssets,
  migrateLegacyLocalStorage,
  ProjectNotFoundError,
  readStoredProject,
  requestPersistentStorage,
  storeAssets,
  writeStoredProject,
  type StoredProjectMeta,
} from "../utils/projectStorage.ts";
import { embedImages, getAsset, ingestEmbeddedImages, loadedAssetIds, onAssetRegistered, registerAsset } from "../utils/assets.ts";
import { claimLayout } from "../utils/layoutLock.ts";
import type { ClipboardPayload } from "../utils/clipboard.ts";
import { readProjectIdFromLocation, writeProjectIdToLocation } from "../utils/projectUrl.ts";
import {
  applyCropToImageFrame,
  composeCrop,
  cropRelativeTo,
  cutRegionFromImage,
  normalizeCrop,
} from "../utils/cropGeometry.ts";
import {
  getDocumentContentSnapshot,
  normalizeDocument,
  normalizeRotation,
  serializeDocument,
} from "../utils/documentState.ts";
import { getGroupCenteringDelta, sizeForDimension, type SizeAxis } from "../utils/resizeGeometry.ts";

function defaultDoc(id = createProjectId()): DocumentState {
  const tpl = PAGE_TEMPLATES[0];
  return {
    version: 2,
    id,
    name: "Untitled",
    page: { templateId: tpl.id, name: tpl.name, widthMm: tpl.widthMm, heightMm: tpl.heightMm },
    items: [],
    selectedItemId: null,
    selectedItemIds: [],
    zoom: 0.75,
    unit: "mm",
    gridSizeMm: 5,
    showGrid: false,
    snapToGrid: false,
    showGuides: false,
    cropModeItemId: null,
    dirty: false,
  };
}

export const doc = $state<DocumentState>(defaultDoc());
export type RegionEditMode = "crop" | "cut";
type CropSessionBase = Pick<ImageItem, "xMm" | "yMm" | "widthMm" | "heightMm" | "crop">;
const FULL_LOCAL_CROP: ImageCrop = { left: 0, top: 0, right: 1, bottom: 1 };
export const cropSession = $state<{
  itemId: string | null;
  base: CropSessionBase | null;
  mode: RegionEditMode;
  localCrop: ImageCrop | null;
}>({ itemId: null, base: null, mode: "crop", localCrop: null });

// ── Undo / Redo ──────────────────────────────────────────────────────

const MAX_UNDO = 50;
let undoStack: string[] = [];
let redoStack: string[] = [];
let pendingUndoSnapshot: string | null = null;
let textEditItemId: string | null = null;
let cleanContentSnapshot = getDocumentContentSnapshot(doc);

export const undoState = $state({ hasUndo: false, hasRedo: false });
/** Bumped whenever an image is loaded into memory, so items waiting for it re-render. */
export const assetState = $state({ version: 0 });
onAssetRegistered(() => { assetState.version += 1; });
export const persistState = $state({ saving: false, lastSavedAt: 0, failed: false });

function syncUndoFlags(): void {
  undoState.hasUndo = undoStack.length > 0;
  undoState.hasRedo = redoStack.length > 0;
}

export function beginUndo(): void {
  pendingUndoSnapshot = JSON.stringify(doc);
}

export function endUndo(): void {
  pendingUndoSnapshot = null;
}

function appendUndo(snapshot: string): void {
  textEditItemId = null;
  undoStack.push(snapshot);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack = [];
  syncUndoFlags();
}

function commitPendingUndo(): void {
  if (!pendingUndoSnapshot) return;
  appendUndo(pendingUndoSnapshot);
  pendingUndoSnapshot = null;
}

function pushUndo(): void {
  pendingUndoSnapshot = null;
  appendUndo(JSON.stringify(doc));
}

export function undo(): void {
  if (undoStack.length === 0) return;
  redoStack.push(JSON.stringify(doc));
  restoreSnapshot(undoStack.pop()!);
}

export function redo(): void {
  if (redoStack.length === 0) return;
  undoStack.push(JSON.stringify(doc));
  restoreSnapshot(redoStack.pop()!);
}

function restoreSnapshot(snapshot: string): void {
  textEditItemId = null;
  exitCropMode();
  // The layout id names the file autosave writes to; history must never move it.
  const { id: _id, ...state } = JSON.parse(snapshot) as DocumentState;
  Object.assign(doc, state);
  doc.cropModeItemId = null;
  pendingUndoSnapshot = null;
  refreshDirty();
  syncUndoFlags();
}

// ── Helpers ───────────────────────────────────────────────────────────

function markDirty(): void {
  refreshDirty();
}

function refreshDirty(): void {
  doc.dirty = getDocumentContentSnapshot(doc) !== cleanContentSnapshot;
  if (doc.dirty) scheduleAutosave();
}

function markClean(): void {
  cleanContentSnapshot = getDocumentContentSnapshot(doc);
  doc.dirty = false;
}

function getItemById(id: string): DocumentItem | undefined {
  return doc.items.find((i) => i.id === id);
}

export function getItem(id: string): DocumentItem | undefined {
  return getItemById(id);
}

export function getSelectedItem(): DocumentItem | null {
  if (!doc.selectedItemId) return null;
  return getItemById(doc.selectedItemId) ?? null;
}

function sameImageFrame(
  item: ImageItem,
  next: Pick<ImageItem, "crop" | "xMm" | "yMm" | "widthMm" | "heightMm">,
): boolean {
  return (
    item.xMm === next.xMm &&
    item.yMm === next.yMm &&
    item.widthMm === next.widthMm &&
    item.heightMm === next.heightMm &&
    item.crop.left === next.crop.left &&
    item.crop.top === next.crop.top &&
    item.crop.right === next.crop.right &&
    item.crop.bottom === next.crop.bottom
  );
}

function clampShapeAppearance(item: DocumentItem): void {
  if (item.type !== "shape") return;
  item.strokeWidthMm = Math.max(0, Math.min(Math.min(item.widthMm, item.heightMm), item.strokeWidthMm));
  item.cornerRadiusMm = Math.max(
    0,
    Math.min(Math.min(item.widthMm, item.heightMm) / 2, item.cornerRadiusMm),
  );
}

// ── Document ──────────────────────────────────────────────────────────

export function createNewDocument(templateId: string, id = createProjectId()): void {
  const tpl = PAGE_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return;
  const next = defaultDoc(id);
  next.page = { templateId: tpl.id, name: tpl.name, widthMm: tpl.widthMm, heightMm: tpl.heightMm };
  void claimLayout(id);
  clearTimeout(autosaveTimer);
  applyDocument(next);
  persistState.lastSavedAt = 0;
  persistState.failed = false;
  clearHistory();
  markClean();
  writeProjectIdToLocation(doc.id, "replace");
  requestFitPage();
}

export function requestNewDocument(templateId: string): void {
  leaveLayoutThen(() => createNewDocument(templateId));
}

export function setPageSize(widthMm: number, heightMm: number): void {
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return;
  if (widthMm > MAX_PAGE_SIZE_MM || heightMm > MAX_PAGE_SIZE_MM) {
    showNotice("Page dimensions must be between 10 and 2,000 mm.", "error");
    return;
  }
  const nextWidth = Math.max(10, widthMm);
  const nextHeight = Math.max(10, heightMm);
  if (
    doc.page.widthMm === nextWidth &&
    doc.page.heightMm === nextHeight &&
    doc.page.templateId === "custom"
  ) return;
  pushUndo();
  doc.page.widthMm = nextWidth;
  doc.page.heightMm = nextHeight;
  doc.page.templateId = "custom";
  doc.page.name = "Custom";
  markDirty();
  requestFitPage();
}

/** Changing paper preserves artwork and is undoable; New explicitly clears it. */
export function setPageTemplate(templateId: string): void {
  const template = PAGE_TEMPLATES.find((candidate) => candidate.id === templateId);
  if (!template || doc.page.templateId === templateId) return;
  pushUndo();
  doc.page = { templateId, name: template.name, widthMm: template.widthMm, heightMm: template.heightMm };
  markDirty();
  requestFitPage();
}

// ── Selection ─────────────────────────────────────────────────────────

export function selectItem(id: string | null, additive = false): void {
  if (id === null) {
    doc.selectedItemId = null;
    doc.selectedItemIds = [];
  } else if (additive) {
    if (doc.selectedItemIds.includes(id)) {
      doc.selectedItemIds = doc.selectedItemIds.filter((selectedId) => selectedId !== id);
      doc.selectedItemId = doc.selectedItemIds.at(-1) ?? null;
    } else {
      doc.selectedItemIds = [...doc.selectedItemIds, id];
      doc.selectedItemId = id;
    }
  } else if (!doc.selectedItemIds.includes(id)) {
    doc.selectedItemId = id;
    doc.selectedItemIds = [id];
  } else {
    doc.selectedItemId = id;
  }
  exitCropMode();
}

/** Replaces the selection; the primary item (the one the inspector edits) is the last id. */
export function setSelection(ids: string[]): void {
  const ordered = ids.filter((id, index) => ids.indexOf(id) === index && doc.items.some((item) => item.id === id));
  if (ordered.length === doc.selectedItemIds.length && ordered.every((id, index) => doc.selectedItemIds[index] === id)) return;
  doc.selectedItemIds = ordered;
  doc.selectedItemId = ordered.at(-1) ?? null;
  exitCropMode();
}

export function selectAll(): void {
  setSelection(doc.items.map((item) => item.id));
}

function selectedIds(): string[] {
  return doc.selectedItemIds.length
    ? doc.selectedItemIds
    : doc.selectedItemId ? [doc.selectedItemId] : [];
}

// ── Images ────────────────────────────────────────────────────────────

export async function addImage(file: File): Promise<void> {
  if (doc.items.length >= MAX_DOCUMENT_ITEMS) throw new Error("Projects can contain up to 1,000 items.");
  const page = doc.page;
  const { blob, mime, naturalWidthPx, naturalHeightPx } = await loadImageFile(file);
  const asset = await registerAsset(blob, mime);
  if (doc.page !== page) throw new Error("The document changed while the image was loading. Please add it again.");
  if (doc.items.length >= MAX_DOCUMENT_ITEMS) throw new Error("Projects can contain up to 1,000 items.");

  const aspect = naturalWidthPx / naturalHeightPx;
  const maxWidthMm = Math.max(MIN_SIZE_MM, doc.page.widthMm - 20);
  const maxHeightMm = Math.max(MIN_SIZE_MM, doc.page.heightMm - 20);
  const defaultWidthMm = Math.min(80, maxWidthMm, maxHeightMm * aspect);
  const defaultHeightMm = defaultWidthMm / aspect;

  const item: ImageItem = {
    id: createId("img"),
    type: "image",
    name: file.name || "Pasted image",
    assetId: asset.id,
    xMm: (doc.page.widthMm - defaultWidthMm) / 2,
    yMm: (doc.page.heightMm - defaultHeightMm) / 2,
    widthMm: Math.max(MIN_SIZE_MM, defaultWidthMm),
    heightMm: Math.max(MIN_SIZE_MM, defaultHeightMm),
    naturalWidthPx,
    naturalHeightPx,
    rotationDeg: 0,
    lockedAspectRatio: true,
    crop: { left: 0, top: 0, right: 1, bottom: 1 },
    borderWidthMm: 0,
    borderColor: lastImageBorder.color,
  };

  pushUndo();
  doc.items.push(item);
  doc.selectedItemId = item.id;
  doc.selectedItemIds = [item.id];
  markDirty();
}

// ── Shapes ────────────────────────────────────────────────────────────

export function addShape(shapeType: ShapeType): void {
  if (doc.items.length >= MAX_DOCUMENT_ITEMS) { showNotice("Projects can contain up to 1,000 items.", "error"); return; }
  const count = doc.items.filter((item) => item.type === "shape" && item.shapeType === shapeType).length + 1;
  const name = shapeType === "ellipse" ? "Circle" : shapeType === "rect" ? "Rectangle" : "Line";

  const availableWidth = Math.max(MIN_SIZE_MM, doc.page.widthMm - 20);
  const availableHeight = Math.max(MIN_SIZE_MM, doc.page.heightMm - 20);
  const diameter = Math.min(60, availableWidth, availableHeight);
  const widthMm = shapeType === "ellipse" ? diameter : Math.min(80, availableWidth);
  const heightMm = shapeType === "ellipse" ? diameter : Math.min(60, availableHeight);
  const item: ShapeItem = {
    id: createId("shp"),
    type: "shape",
    shapeType,
    name: `${name} ${count}`,
    xMm: (doc.page.widthMm - widthMm) / 2,
    yMm: (doc.page.heightMm - heightMm) / 2,
    widthMm,
    heightMm,
    rotationDeg: 0,
    lockedAspectRatio: shapeType === "ellipse",
    fill: shapeType === "line" ? "none" : "#3b82f6",
    stroke: "#1e40af",
    strokeWidthMm: 1,
    cornerRadiusMm: 0,
  };

  pushUndo();
  doc.items.push(item);
  doc.selectedItemId = item.id;
  doc.selectedItemIds = [item.id];
  markDirty();
}

export function addText(): void {
  if (doc.items.length >= MAX_DOCUMENT_ITEMS) { showNotice("Projects can contain up to 1,000 items.", "error"); return; }
  const count = doc.items.filter((item) => item.type === "text").length + 1;
  const widthMm = Math.max(MIN_SIZE_MM, Math.min(100, doc.page.widthMm - 20));
  const heightMm = Math.max(MIN_SIZE_MM, Math.min(20, doc.page.heightMm - 20));
  const item: TextItem = {
    id: createId("txt"),
    type: "text",
    name: `Text ${count}`,
    text: "Edit this text",
    xMm: (doc.page.widthMm - widthMm) / 2,
    yMm: (doc.page.heightMm - heightMm) / 2,
    widthMm,
    heightMm,
    rotationDeg: 0,
    lockedAspectRatio: false,
    fontSizeMm: 6,
    fontFamily: "Arial, sans-serif",
    fontWeight: "400",
    textAlign: "left",
    color: "#111827",
  };
  pushUndo();
  doc.items.push(item);
  doc.selectedItemId = item.id;
  doc.selectedItemIds = [item.id];
  markDirty();
}

export function updateText(id: string, patch: Partial<TextItem>, coalesce = false): void {
  const item = getItemById(id);
  if (!item || item.type !== "text") return;
  if (Object.entries(patch).every(([key, value]) => item[key as keyof TextItem] === value)) return;
  if (!coalesce || textEditItemId !== id) pushUndo();
  textEditItemId = coalesce ? id : null;
  Object.assign(item, patch);
  markDirty();
}

export function endTextEdit(): void {
  textEditItemId = null;
}

export function setShapeFill(id: string, fill: string): void {
  const item = getItemById(id);
  if (!item || item.type !== "shape" || item.fill === fill) return;
  pushUndo();
  item.fill = fill;
  markDirty();
}

export function setShapeStroke(id: string, stroke: string): void {
  const item = getItemById(id);
  if (!item || item.type !== "shape" || item.stroke === stroke) return;
  pushUndo();
  item.stroke = stroke;
  markDirty();
}

export function setShapeStrokeWidth(id: string, mm: number): void {
  const item = getItemById(id);
  if (!item || item.type !== "shape" || !Number.isFinite(mm)) return;
  const maxStroke = Math.min(item.widthMm, item.heightMm);
  const width = Math.max(0, Math.min(maxStroke, mm));
  if (item.strokeWidthMm === width) return;
  pushUndo();
  item.strokeWidthMm = width;
  markDirty();
}

export function setShapeCornerRadius(id: string, mm: number): void {
  const item = getItemById(id);
  if (!item || item.type !== "shape" || !Number.isFinite(mm)) return;
  const radius = Math.max(0, Math.min(Math.min(item.widthMm, item.heightMm) / 2, mm));
  if (item.cornerRadiusMm === radius) return;
  pushUndo();
  item.cornerRadiusMm = radius;
  markDirty();
}

export function deleteSelectedItem(): void {
  const ids = selectedIds();
  if (!ids.length) return;
  pushUndo();
  doc.items = doc.items.filter((i) => !ids.includes(i.id));
  doc.selectedItemId = null;
  doc.selectedItemIds = [];
  exitCropMode();
  markDirty();
}

export function duplicateSelectedItem(): void {
  const ids = selectedIds();
  const items = doc.items.filter((item) => ids.includes(item.id));
  if (!items.length) return;
  insertClones(items.map((item) => ({ ...item, name: `${item.name} copy`, xMm: item.xMm + 10, yMm: item.yMm + 10 })));
}

function cloneWithNewId(item: DocumentItem): DocumentItem {
  const prefix = item.type === "image" ? "img" : item.type === "text" ? "txt" : "shp";
  return { ...$state.snapshot(item) as DocumentItem, id: createId(prefix) };
}

function insertClones(items: DocumentItem[]): boolean {
  if (doc.items.length + items.length > MAX_DOCUMENT_ITEMS) { showNotice("Projects can contain up to 1,000 items.", "error"); return false; }
  pushUndo();
  const clones = items.map(cloneWithNewId);
  doc.items.push(...clones);
  doc.selectedItemIds = clones.map((item) => item.id);
  doc.selectedItemId = clones.at(-1)?.id ?? null;
  exitCropMode();
  markDirty();
  return true;
}

// ── Clipboard ─────────────────────────────────────────────────────────

let clipboard: ClipboardPayload | null = null;
let pendingSystemCopy: ClipboardPayload | null = null;

/**
 * The payload copied during the current event, for the browser's copy event to
 * put on the system clipboard. It expires at the end of the task so a later
 * text copy never picks up stale items.
 */
export function takePendingSystemCopy(): ClipboardPayload | null {
  const payload = pendingSystemCopy;
  pendingSystemCopy = null;
  return payload;
}

export function copySelection(): ClipboardPayload | null {
  const ids = selectedIds();
  const items = doc.items.filter((item) => ids.includes(item.id));
  if (!items.length) return null;
  const assets = new Map<string, ClipboardPayload["assets"][number]>();
  for (const item of items) {
    const asset = item.type === "image" ? getAsset(item.assetId) : undefined;
    if (asset) assets.set(asset.id, { id: asset.id, mime: asset.mime });
  }
  clipboard = {
    format: "tinycut-items",
    version: 1,
    items: items.map((item) => $state.snapshot(item) as DocumentItem),
    assets: [...assets.values()],
  };
  pendingSystemCopy = clipboard;
  setTimeout(() => { pendingSystemCopy = null; }, 0);
  // Another tab can only paste these images once their bytes are in browser storage.
  // Rewriting them also restarts the cleanup grace period.
  storeAssets(assets.keys(), 0).catch(() => {});
  return clipboard;
}

export function cutSelection(): ClipboardPayload | null {
  const payload = copySelection();
  if (payload) deleteSelectedItem();
  return payload;
}

export function hasClipboardItems(): boolean {
  return clipboard !== null;
}

/** Pastes items copied in this tab or, through the system clipboard, in another one. */
export async function pasteItems(payload: ClipboardPayload | null = clipboard): Promise<boolean> {
  if (!payload?.items.length) return false;
  const docId = doc.id;
  const missing = await loadStoredAssets(payload.assets);
  if (doc.id !== docId) return false;
  let items: DocumentItem[];
  try {
    items = normalizeDocument({ version: 2, page: doc.page, items: payload.items }).items;
  } catch {
    showNotice("The copied items could not be pasted", "error");
    return false;
  }
  const pasteable = items.filter((item) => item.type !== "image" || getAsset(item.assetId));
  if (missing || pasteable.length < items.length) {
    showNotice("Some copied images are no longer in this browser and were skipped", "error");
  }
  if (!pasteable.length) return false;
  const offset = pasteOffset(pasteable);
  return insertClones(pasteable.map((item) => ({ ...item, xMm: item.xMm + offset, yMm: item.yMm + offset })));
}

/** Paste in place, unless that would land exactly on top of what is already there. */
function pasteOffset(items: DocumentItem[]): number {
  const taken = new Set(doc.items.map((item) => `${item.xMm},${item.yMm}`));
  let offset = 0;
  while (offset < 200 && items.some((item) => taken.has(`${item.xMm + offset},${item.yMm + offset}`))) offset += 10;
  return offset;
}

// ── Z-Order ───────────────────────────────────────────────────────────

export function bringForward(id: string): void {
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx === -1 || idx === doc.items.length - 1) return;
  pushUndo();
  const item = doc.items[idx];
  doc.items.splice(idx, 1);
  doc.items.splice(idx + 1, 0, item);
  markDirty();
}

export function sendBackward(id: string): void {
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx === -1 || idx === 0) return;
  pushUndo();
  const item = doc.items[idx];
  doc.items.splice(idx, 1);
  doc.items.splice(idx - 1, 0, item);
  markDirty();
}

export function bringToFront(id: string): void {
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx === -1 || idx === doc.items.length - 1) return;
  pushUndo();
  const item = doc.items[idx];
  doc.items.splice(idx, 1);
  doc.items.push(item);
  markDirty();
}

export function sendToBack(id: string): void {
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx === -1 || idx === 0) return;
  pushUndo();
  const item = doc.items[idx];
  doc.items.splice(idx, 1);
  doc.items.unshift(item);
  markDirty();
}

export function centerSelectedOnPage(axis: "horizontal" | "vertical" | "both"): void {
  const ids = selectedIds();
  const items = doc.items.filter((item) => ids.includes(item.id));
  if (!items.length) return;
  const { dxMm: dx, dyMm: dy } = getGroupCenteringDelta(
    items,
    doc.page.widthMm,
    doc.page.heightMm,
  );
  if ((axis === "vertical" || dx === 0) && (axis === "horizontal" || dy === 0)) return;
  pushUndo();
  for (const item of items) {
    if (axis !== "vertical") item.xMm += dx;
    if (axis !== "horizontal") item.yMm += dy;
  }
  markDirty();
}

export function moveItemsByDelta(
  ids: string[],
  dxMm: number,
  dyMm: number,
  starts: Record<string, { xMm: number; yMm: number }>,
): void {
  const changed = ids.some((id) => {
    const item = getItemById(id);
    const start = starts[id];
    return item && start && (item.xMm !== start.xMm + dxMm || item.yMm !== start.yMm + dyMm);
  });
  if (!changed) return;
  commitPendingUndo();
  for (const id of ids) {
    const item = getItemById(id);
    const start = starts[id];
    if (!item || !start) continue;
    item.xMm = start.xMm + dxMm;
    item.yMm = start.yMm + dyMm;
  }
  markDirty();
}

export function snapValue(value: number): number {
  if (!doc.snapToGrid || doc.gridSizeMm <= 0) return value;
  return Math.round(value / doc.gridSizeMm) * doc.gridSizeMm;
}

export function nudgeItem(id: string, dxMm: number, dyMm: number): void {
  const ids = doc.selectedItemIds.includes(id) ? doc.selectedItemIds : [id];
  if (!ids.length) return;
  pushUndo();
  for (const selectedId of ids) {
    const item = getItemById(selectedId);
    if (!item) continue;
    item.xMm += dxMm;
    item.yMm += dyMm;
  }
  markDirty();
}

export function setGridSettings(
  patch: Partial<Pick<DocumentState, "gridSizeMm" | "showGrid" | "snapToGrid" | "showGuides">>,
): void {
  const next = {
    gridSizeMm: patch.gridSizeMm === undefined
      ? doc.gridSizeMm
      : Number.isFinite(patch.gridSizeMm) ? Math.max(1, patch.gridSizeMm) : doc.gridSizeMm,
    showGrid: patch.showGrid ?? doc.showGrid,
    snapToGrid: patch.snapToGrid ?? doc.snapToGrid,
    showGuides: patch.showGuides ?? doc.showGuides,
  };
  if (
    next.gridSizeMm === doc.gridSizeMm &&
    next.showGrid === doc.showGrid &&
    next.snapToGrid === doc.snapToGrid &&
    next.showGuides === doc.showGuides
  ) return;
  pushUndo();
  Object.assign(doc, next);
  markDirty();
}

export function setItemWidth(id: string, widthMm: number): void {
  setItemsSize([id], "width", widthMm);
}

export function setItemHeight(id: string, heightMm: number): void {
  setItemsSize([id], "height", heightMm);
}

/** One undo step that gives every listed item the same width or height. */
export function setItemsSize(ids: string[], axis: SizeAxis, valueMm: number): void {
  if (!Number.isFinite(valueMm)) return;
  const changes = ids.flatMap((id) => {
    const item = getItemById(id);
    if (!item) return [];
    const size = sizeForDimension(item, axis, valueMm, MIN_SIZE_MM);
    return item.widthMm === size.widthMm && item.heightMm === size.heightMm ? [] : [{ item, size }];
  });
  if (!changes.length) return;
  pushUndo();
  for (const { item, size } of changes) {
    Object.assign(item, size);
    clampShapeAppearance(item);
  }
  markDirty();
}

export function setSelectionSize(axis: SizeAxis, valueMm: number): void {
  setItemsSize(selectedIds(), axis, valueMm);
}

/** Gives the whole selection the primary item's width or height. */
export function matchSelectionSize(axis: SizeAxis): void {
  const primary = getSelectedItem();
  if (primary) setSelectionSize(axis, axis === "width" ? primary.widthMm : primary.heightMm);
}

export function resizeItem(
  id: string,
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
): void {
  const item = getItemById(id);
  if (![xMm, yMm, widthMm, heightMm].every(Number.isFinite) || !item) return;
  const width = Math.max(MIN_SIZE_MM, widthMm);
  const height = Math.max(MIN_SIZE_MM, heightMm);
  if (item.xMm === xMm && item.yMm === yMm && item.widthMm === width && item.heightMm === height) return;
  commitPendingUndo();
  item.xMm = xMm;
  item.yMm = yMm;
  item.widthMm = width;
  item.heightMm = height;
  clampShapeAppearance(item);
  markDirty();
}

export function setItemX(id: string, xMm: number): void {
  const item = getItemById(id);
  if (!item || !Number.isFinite(xMm) || item.xMm === xMm) return;
  pushUndo();
  item.xMm = xMm;
  markDirty();
}

export function setItemY(id: string, yMm: number): void {
  const item = getItemById(id);
  if (!item || !Number.isFinite(yMm) || item.yMm === yMm) return;
  pushUndo();
  item.yMm = yMm;
  markDirty();
}

export function setItemRotation(id: string, degrees: number): void {
  const item = getItemById(id);
  if (!item || !Number.isFinite(degrees)) return;
  const rotation = normalizeRotation(degrees);
  if (item.rotationDeg === rotation) return;
  pushUndo();
  item.rotationDeg = rotation;
  markDirty();
}

/** Update rotation during a pointer gesture previously opened with beginUndo(). */
export function updateItemRotation(id: string, degrees: number): void {
  const item = getItemById(id);
  if (!item || !Number.isFinite(degrees)) return;
  const rotation = normalizeRotation(degrees);
  if (item.rotationDeg === rotation) return;
  commitPendingUndo();
  item.rotationDeg = rotation;
  markDirty();
}

export function setLockedAspect(id: string, locked: boolean): void {
  const item = getItemById(id);
  if (!item || item.lockedAspectRatio === locked) return;
  pushUndo();
  item.lockedAspectRatio = locked;
  markDirty();
}

// ── Image border ──────────────────────────────────────────────────────

/** Last border used, so enabling a border on the next image reuses it. */
const lastImageBorder = { widthMm: 2, color: "#000000" };

function maxImageBorderMm(item: ImageItem): number {
  return Math.min(item.widthMm, item.heightMm) / 2;
}

export function setImageBorderWidth(id: string, mm: number): void {
  const item = getItemById(id);
  if (!item || item.type !== "image" || !Number.isFinite(mm)) return;
  const width = Math.max(0, Math.min(maxImageBorderMm(item), mm));
  if (item.borderWidthMm === width) return;
  pushUndo();
  item.borderWidthMm = width;
  if (width > 0) lastImageBorder.widthMm = width;
  markDirty();
}

export function setImageBorderColor(id: string, color: string): void {
  const item = getItemById(id);
  if (!item || item.type !== "image" || item.borderColor === color) return;
  pushUndo();
  item.borderColor = color;
  lastImageBorder.color = color;
  markDirty();
}

export function toggleImageBorder(id: string, enabled: boolean): void {
  const item = getItemById(id);
  if (!item || item.type !== "image") return;
  if (!enabled) { setImageBorderWidth(id, 0); return; }
  if (item.borderWidthMm > 0) return;
  pushUndo();
  item.borderWidthMm = Math.min(maxImageBorderMm(item), lastImageBorder.widthMm);
  item.borderColor = lastImageBorder.color;
  markDirty();
}

// ── Crop ──────────────────────────────────────────────────────────────

export function setCrop(id: string, crop: ImageCrop): void {
  const item = getItemById(id);
  if (!item || item.type !== "image") return;
  const next = applyCropToImageFrame(item, crop);
  if (sameImageFrame(item, next)) return;
  pushUndo();
  Object.assign(item, next);
  markDirty();
}

export function updateCrop(id: string, crop: ImageCrop): void {
  const item = getItemById(id);
  if (!item || item.type !== "image") return;
  const next = applyCropToImageFrame(item, crop);
  if (sameImageFrame(item, next)) return;
  commitPendingUndo();
  Object.assign(item, next);
  markDirty();
}

export function resetCrop(id: string): void {
  const item = getItemById(id);
  if (!item || item.type !== "image") return;
  const next = applyCropToImageFrame(item, { left: 0, top: 0, right: 1, bottom: 1 });
  if (sameImageFrame(item, next)) return;
  exitCropMode();
  pushUndo();
  Object.assign(item, next);
  markDirty();
}

function beginRegionMode(id: string | null, mode: RegionEditMode): void {
  const item = id ? getItemById(id) : null;
  const image = item?.type === "image" ? item : null;
  cropSession.itemId = image?.id ?? null;
  cropSession.base = image ? {
    xMm: image.xMm,
    yMm: image.yMm,
    widthMm: image.widthMm,
    heightMm: image.heightMm,
    crop: { ...image.crop },
  } : null;
  cropSession.mode = mode;
  // A cut starts with nothing marked; the user draws the piece on the image.
  cropSession.localCrop = image && mode === "crop" ? { ...FULL_LOCAL_CROP } : null;
  doc.cropModeItemId = cropSession.itemId;
}

export function enterCropMode(id: string | null): void {
  beginRegionMode(id, "crop");
}

export function enterCutMode(id: string | null): void {
  beginRegionMode(id, "cut");
}

export function exitCropMode(): void {
  doc.cropModeItemId = null;
  cropSession.itemId = null;
  cropSession.base = null;
  cropSession.mode = "crop";
  cropSession.localCrop = null;
}

/** The marked region within the visible image; null while a cut has nothing marked yet. */
export function getSessionLocalCrop(item: ImageItem): ImageCrop | null {
  if (cropSession.itemId !== item.id) return { ...FULL_LOCAL_CROP };
  if (cropSession.mode === "cut") return cropSession.localCrop;
  if (cropSession.base) return cropRelativeTo(cropSession.base.crop, item.crop);
  return { ...FULL_LOCAL_CROP };
}

export function updateSessionLocalCrop(id: string, crop: ImageCrop | null): void {
  if (cropSession.itemId !== id) return;
  if (cropSession.mode === "cut") {
    cropSession.localCrop = crop ? normalizeCrop(crop) : null;
    return;
  }
  updateCropRelativeToSession(id, crop ?? FULL_LOCAL_CROP);
}

export function setCropRelativeToSession(id: string, crop: ImageCrop): void {
  const base = cropSession.itemId === id ? cropSession.base : null;
  if (base) setCrop(id, composeCrop(base.crop, crop));
}

export function updateCropRelativeToSession(id: string, crop: ImageCrop): void {
  const base = cropSession.itemId === id ? cropSession.base : null;
  if (base) updateCrop(id, composeCrop(base.crop, crop));
}

/** Cuts the marked piece into a new item and clears the mark so the next piece can be drawn. */
export function applyCutFromSession(id: string, localCrop?: ImageCrop): boolean {
  const item = getItemById(id);
  if (!item || item.type !== "image") return false;
  if (doc.items.length >= MAX_DOCUMENT_ITEMS) {
    showNotice("Projects can contain up to 1,000 items.", "error");
    return false;
  }
  const marked = localCrop ?? (cropSession.itemId === id ? cropSession.localCrop : null);
  if (!marked) {
    showNotice("Drag on the image to mark the piece you want to cut", "info");
    return false;
  }
  const local = normalizeCrop(marked);
  if (cropSession.itemId === id) cropSession.localCrop = null;
  const frame = cutRegionFromImage(item, local);
  const cut: ImageItem = {
    ...item,
    ...frame,
    id: createId("img"),
    name: `${item.name} cut`,
    crop: { ...frame.crop },
    xMm: frame.xMm + 10,
    yMm: frame.yMm + 10,
  };
  pushUndo();
  doc.items.push(cut);
  doc.selectedItemId = item.id;
  doc.selectedItemIds = [item.id];
  markDirty();
  return true;
}

// ── Zoom / Unit ───────────────────────────────────────────────────────

export function setZoom(zoom: number): void {
  if (!Number.isFinite(zoom)) return;
  doc.zoom = Math.round(Math.max(0.05, Math.min(10, zoom)) * 100) / 100;
}

export function setUnit(unit: Unit): void {
  doc.unit = unit;
}

// ── Persistence ───────────────────────────────────────────────────────
//
// Every layout saves itself to this browser's private file system shortly after
// each change (see utils/projectStorage.ts for the file layout). A fresh, empty
// tab writes nothing until it has content, so new tabs do not litter the list.

const AUTOSAVE_DELAY_MS = 800;
let autosaveEnabled = false;
let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
let activeSave: Promise<boolean> | null = null;
let persistenceRequested = false;

/** Turned on by bootDocument; tests drive saves explicitly. */
export function setAutosave(enabled: boolean): void {
  autosaveEnabled = enabled;
  if (!enabled) clearTimeout(autosaveTimer);
}

function worthSaving(): boolean {
  return persistState.lastSavedAt > 0 || doc.items.length > 0 || doc.name !== "Untitled";
}

export type SaveStatus = "new" | "saving" | "saved" | "failed";

/** What the toolbar shows: an empty fresh tab is "new" because nothing is written for it yet. */
export function saveStatus(): SaveStatus {
  if (persistState.failed) return "failed";
  if (persistState.saving || (doc.dirty && worthSaving())) return "saving";
  return persistState.lastSavedAt > 0 ? "saved" : "new";
}

/** True when closing the tab now would lose work. */
export function hasUnsavedWork(): boolean {
  return persistState.saving || (doc.dirty && worthSaving());
}

function scheduleAutosave(): void {
  if (!autosaveEnabled || !worthSaving()) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => { void saveProject({ quiet: true }); }, AUTOSAVE_DELAY_MS);
}

export async function bootDocument(): Promise<void> {
  setAutosave(true);
  let recovered = false;
  try {
    recovered = Boolean(await migrateLegacyLocalStorage());
  } catch {
    recovered = false;
  }
  const fromUrl = readProjectIdFromLocation();
  let result: LoadResult = fromUrl ? await loadProject(fromUrl) : "not-found";
  // An id that is in the URL but not saved yet may belong to an empty tab that
  // has not saved; only adopt it while holding its lock.
  if (result === "not-found" && fromUrl && !(await claimLayout(fromUrl))) result = "locked";
  if (result === "not-found") createNewDocument("a4-portrait", fromUrl ?? undefined);
  else if (result !== "opened") createNewDocument("a4-portrait");
  if (result === "locked") {
    showNotice("That layout is already open in another tab, so this tab started a new one.", "info");
  } else if (result === "invalid") {
    showNotice("The saved layout is invalid or unreadable", "error");
  } else if (recovered) {
    showNotice("A layout from an older TinyCut version is in Your layouts.", "info");
  }
  setTimeout(() => { void cleanUpStorage(); }, 5_000);
}

/** Writes the layout now. Autosave calls this quietly; Ctrl+S confirms with a notice. */
export async function saveProject(options: { quiet?: boolean } = {}): Promise<boolean> {
  // An explicit save closes the typing undo group; autosave pauses must not split it.
  if (!options.quiet) endTextEdit();
  clearTimeout(autosaveTimer);
  while (activeSave) await activeSave;
  activeSave = writeCurrentLayout(options.quiet ?? false);
  try {
    return await activeSave;
  } finally {
    activeSave = null;
  }
}

async function writeCurrentLayout(quiet: boolean): Promise<boolean> {
  persistState.saving = true;
  const id = doc.id;
  const snapshot = getDocumentContentSnapshot(doc);
  try {
    const meta = await writeStoredProject(doc);
    if (doc.id === id) {
      persistState.lastSavedAt = meta.updatedAt;
      persistState.failed = false;
      if (getDocumentContentSnapshot(doc) === snapshot) markClean();
      else scheduleAutosave();
      writeProjectIdToLocation(doc.id, "replace");
    }
    if (!persistenceRequested) {
      persistenceRequested = true;
      void requestPersistentStorage();
    }
    if (!quiet) showNotice("Saved in this browser", "success");
    return true;
  } catch {
    if (doc.id === id) persistState.failed = true;
    showNotice("Could not save in this browser. Download a backup from the Project menu to keep your work.", "error");
    return false;
  } finally {
    persistState.saving = false;
  }
}

/** Saves any pending change. Resolves true when leaving this layout would lose nothing. */
export async function flushAutosave(): Promise<boolean> {
  // Edits made while a save runs need another save, so repeat until it settles.
  for (let attempt = 0; attempt < 5; attempt++) {
    while (activeSave) await activeSave;
    if (!doc.dirty || !worthSaving()) return true;
    if (!autosaveEnabled || !(await saveProject({ quiet: true }))) return false;
  }
  return !doc.dirty;
}

function leaveLayoutThen(action: () => unknown): void {
  void flushAutosave().then((safe) => {
    if (safe) void action();
    else confirmAction(() => { void action(); });
  });
}

type LoadResult = "opened" | "not-found" | "locked" | "invalid" | "unsaved";

/**
 * Waits for saves in flight and saves edits made meanwhile, right before the
 * current layout is replaced. False means replacing it would lose work.
 */
async function settleBeforeReplacing(): Promise<boolean> {
  while (activeSave) await activeSave;
  return !autosaveEnabled || flushAutosave();
}

async function loadProject(id: string): Promise<LoadResult> {
  let stored;
  try {
    stored = await readStoredProject(id);
  } catch (error) {
    return error instanceof ProjectNotFoundError ? "not-found" : "invalid";
  }
  if (!(await settleBeforeReplacing())) return "unsaved";
  if (!(await claimLayout(id))) return "locked";
  clearTimeout(autosaveTimer);
  applyDocument(stored.document);
  persistState.lastSavedAt = stored.meta.updatedAt || Date.now();
  persistState.failed = false;
  clearHistory();
  markClean();
  writeProjectIdToLocation(doc.id, "replace");
  requestFitPage();
  if (stored.missingImages) {
    showNotice(`${stored.missingImages} image${stored.missingImages === 1 ? " is" : "s are"} missing from browser storage`, "error");
  }
  return "opened";
}

export async function openProject(id: string, showFeedback = true): Promise<boolean> {
  const result = await loadProject(id);
  if (showFeedback) {
    if (result === "opened") showNotice("Layout opened", "success");
    else if (result === "locked") showNotice("That layout is open in another tab. Switch to that tab to keep editing it.", "info");
    else if (result === "not-found") showNotice("That layout was not found in this browser", "info");
    else if (result === "unsaved") showNotice("This layout could not be saved, so the other one was not opened. Download a backup first.", "error");
    else showNotice("The saved layout is invalid or unreadable", "error");
  }
  return result === "opened";
}

export function requestOpenProject(id: string): void {
  if (id === doc.id) return;
  leaveLayoutThen(() => openProject(id));
}

export function requestOpenProjects(): void {
  showOpenProjects();
}

export function requestLoadFromHash(): void {
  const id = readProjectIdFromLocation();
  if (id === doc.id) return;
  writeProjectIdToLocation(doc.id, "replace");
  if (id) requestOpenProject(id);
}

/** Saves the layout under a new id and keeps editing the copy; the original stays as it was. */
export async function duplicateLayout(): Promise<void> {
  if (!(await flushAutosave())) return;
  const id = createProjectId();
  await claimLayout(id);
  clearTimeout(autosaveTimer);
  doc.id = id;
  doc.name = `${doc.name} copy`.slice(0, 80);
  persistState.lastSavedAt = 0;
  clearHistory();
  markDirty();
  if (await saveProject({ quiet: true })) {
    showNotice("Copy saved. You are now editing the copy.", "success");
  }
}

export async function listProjects(): Promise<StoredProjectMeta[]> {
  return listStoredProjects();
}

export async function deleteProject(id: string): Promise<void> {
  // An in-flight save of this layout would otherwise write it back after the delete.
  while (activeSave) await activeSave;
  if (doc.id === id) {
    clearTimeout(autosaveTimer);
    createNewDocument("a4-portrait");
  }
  await deleteStoredProject(id);
  showNotice("Layout deleted from this browser", "success");
  void cleanUpStorage();
}

/** Removes image files that no saved layout, and nothing open in this tab, still uses. */
async function cleanUpStorage(): Promise<void> {
  try {
    await collectUnusedAssets(loadedAssetIds());
  } catch {
    // Cleanup is best effort; the files stay until the next try.
  }
}

export function setProjectName(name: string): void {
  const next = name.trim().slice(0, 80) || "Untitled";
  if (doc.name === next) {
    refreshDirty();
    return;
  }
  pushUndo();
  doc.name = next;
  markDirty();
}

/** A single JSON file with the images embedded, readable by any TinyCut version. */
export async function exportBackup(): Promise<string> {
  const persisted = JSON.parse(serializeDocument(doc)) as DocumentState;
  return JSON.stringify(await embedImages(persisted), null, 2);
}

export async function importJson(file: File): Promise<void> {
  if (file.size > MAX_PROJECT_FILE_BYTES) throw new Error("Project files must be 50 MB or smaller.");
  const before = getDocumentContentSnapshot(doc);
  const text = await file.text();
  const parsed = normalizeDocument(await ingestEmbeddedImages(JSON.parse(text)));
  parsed.id = createProjectId();
  if (getDocumentContentSnapshot(doc) !== before) throw new Error("The document changed while importing. Please open the project again.");
  if (!(await settleBeforeReplacing())) throw new Error("This layout could not be saved, so the backup was not opened.");
  await claimLayout(parsed.id);
  clearTimeout(autosaveTimer);
  applyDocument(parsed);
  persistState.lastSavedAt = 0;
  persistState.failed = false;
  clearHistory();
  writeProjectIdToLocation(doc.id, "replace");
  requestFitPage();
  markDirty();
  if (await saveProject({ quiet: true })) showNotice("Backup imported and saved in this browser", "success");
}

export function requestImportJson(file: File): void {
  leaveLayoutThen(() => importJson(file).catch((error) => showNotice(error instanceof Error && !(error instanceof SyntaxError) ? error.message : "The selected backup file is invalid", "error")));
}

function applyDocument(next: DocumentState): void {
  exitCropMode();
  doc.id = next.id;
  doc.name = next.name;
  doc.version = next.version;
  doc.page = next.page;
  doc.items = next.items;
  doc.selectedItemId = next.selectedItemId;
  doc.selectedItemIds = next.selectedItemIds;
  doc.zoom = next.zoom;
  doc.unit = next.unit;
  doc.gridSizeMm = next.gridSizeMm;
  doc.showGrid = next.showGrid;
  doc.snapToGrid = next.snapToGrid;
  doc.showGuides = next.showGuides;
  doc.cropModeItemId = next.cropModeItemId;
  doc.dirty = next.dirty;
}

function clearHistory(): void {
  textEditItemId = null;
  undoStack = [];
  redoStack = [];
  pendingUndoSnapshot = null;
  syncUndoFlags();
}
