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
  LOCAL_STORAGE_KEY,
  MIN_SIZE_MM,
} from "../types/document.ts";
import { createId } from "../utils/ids.ts";
import { loadImageFile } from "../utils/image.ts";
import { confirmAction, showNotice } from "./uiStore.svelte.ts";
import { applyCropToImageFrame } from "../utils/cropGeometry.ts";
import {
  getDocumentContentSnapshot,
  normalizeDocument,
  normalizeRotation,
  serializeDocument,
} from "../utils/documentState.ts";
import { getGroupCenteringDelta } from "../utils/resizeGeometry.ts";

function defaultDoc(): DocumentState {
  const tpl = PAGE_TEMPLATES[0];
  return {
    version: 2,
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

// ── Undo / Redo ──────────────────────────────────────────────────────

const MAX_UNDO = 50;
let undoStack: string[] = [];
let redoStack: string[] = [];
let pendingUndoSnapshot: string | null = null;
let cleanContentSnapshot = getDocumentContentSnapshot(doc);

export const undoState = $state({ hasUndo: false, hasRedo: false });

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
  const snapshot = JSON.parse(undoStack.pop()!) as DocumentState;
  Object.assign(doc, snapshot);
  pendingUndoSnapshot = null;
  refreshDirty();
  syncUndoFlags();
}

export function redo(): void {
  if (redoStack.length === 0) return;
  undoStack.push(JSON.stringify(doc));
  const snapshot = JSON.parse(redoStack.pop()!) as DocumentState;
  Object.assign(doc, snapshot);
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

export function createNewDocument(templateId: string): void {
  const tpl = PAGE_TEMPLATES.find((t) => t.id === templateId);
  if (tpl) {
    Object.assign(doc, defaultDoc());
    doc.page = { templateId: tpl.id, name: tpl.name, widthMm: tpl.widthMm, heightMm: tpl.heightMm };
    clearHistory();
    markClean();
  }
}

export function requestNewDocument(templateId: string): void {
  if (doc.dirty) {
    confirmAction(() => createNewDocument(templateId));
  } else {
    createNewDocument(templateId);
  }
}

export function setPageSize(widthMm: number, heightMm: number): void {
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return;
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
  doc.cropModeItemId = null;
}

// ── Images ────────────────────────────────────────────────────────────

export async function addImage(file: File): Promise<void> {
  const { src, naturalWidthPx, naturalHeightPx } = await loadImageFile(file);

  const aspect = naturalWidthPx / naturalHeightPx;
  const maxWidthMm = Math.max(MIN_SIZE_MM, doc.page.widthMm - 20);
  const maxHeightMm = Math.max(MIN_SIZE_MM, doc.page.heightMm - 20);
  const defaultWidthMm = Math.min(80, maxWidthMm, maxHeightMm * aspect);
  const defaultHeightMm = defaultWidthMm / aspect;

  const item: ImageItem = {
    id: createId("img"),
    type: "image",
    name: file.name,
    src,
    xMm: (doc.page.widthMm - defaultWidthMm) / 2,
    yMm: (doc.page.heightMm - defaultHeightMm) / 2,
    widthMm: Math.max(MIN_SIZE_MM, defaultWidthMm),
    heightMm: Math.max(MIN_SIZE_MM, defaultHeightMm),
    naturalWidthPx,
    naturalHeightPx,
    rotationDeg: 0,
    lockedAspectRatio: true,
    crop: { left: 0, top: 0, right: 1, bottom: 1 },
  };

  pushUndo();
  doc.items.push(item);
  doc.selectedItemId = item.id;
  doc.selectedItemIds = [item.id];
  markDirty();
}

// ── Shapes ────────────────────────────────────────────────────────────

export function addShape(shapeType: ShapeType): void {
  const count = doc.items.filter((item) => item.type === "shape" && item.shapeType === shapeType).length + 1;
  const name = shapeType === "ellipse" ? "Circle" : shapeType.charAt(0).toUpperCase() + shapeType.slice(1);

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

export function updateText(id: string, patch: Partial<TextItem>): void {
  const item = getItemById(id);
  if (!item || item.type !== "text") return;
  if (Object.entries(patch).every(([key, value]) => item[key as keyof TextItem] === value)) return;
  pushUndo();
  Object.assign(item, patch);
  markDirty();
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
  const selectedIds = doc.selectedItemIds.length
    ? doc.selectedItemIds
    : doc.selectedItemId ? [doc.selectedItemId] : [];
  if (!selectedIds.length) return;
  pushUndo();
  doc.items = doc.items.filter((i) => !selectedIds.includes(i.id));
  doc.selectedItemId = null;
  doc.selectedItemIds = [];
  doc.cropModeItemId = null;
  markDirty();
}

export function duplicateSelectedItem(): void {
  const selectedIds = doc.selectedItemIds.length
    ? doc.selectedItemIds
    : doc.selectedItemId ? [doc.selectedItemId] : [];
  const items = doc.items.filter((item) => selectedIds.includes(item.id));
  if (!items.length) return;
  pushUndo();
  const clones = items.map((item) => {
    const prefix = item.type === "image" ? "img" : item.type === "text" ? "txt" : "shp";
    return {
      ...item,
      id: createId(prefix),
      name: item.name + " copy",
      xMm: item.xMm + 10,
      yMm: item.yMm + 10,
    } as DocumentItem;
  });
  doc.items.push(...clones);
  doc.selectedItemIds = clones.map((item) => item.id);
  doc.selectedItemId = clones.at(-1)?.id ?? null;
  markDirty();
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
  const selectedIds = doc.selectedItemIds.length
    ? doc.selectedItemIds
    : doc.selectedItemId ? [doc.selectedItemId] : [];
  const items = doc.items.filter((item) => selectedIds.includes(item.id));
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
  const item = getItemById(id);
  if (!item || !Number.isFinite(widthMm)) return;
  const aspect = item.widthMm / item.heightMm || 1;
  const w = Math.max(MIN_SIZE_MM, widthMm);
  const h = item.lockedAspectRatio ? Math.max(MIN_SIZE_MM, w / aspect) : item.heightMm;
  if (item.widthMm === w && item.heightMm === h) return;
  pushUndo();
  item.widthMm = w;
  if (item.lockedAspectRatio) {
    item.heightMm = h;
  }
  clampShapeAppearance(item);
  markDirty();
}

export function setItemHeight(id: string, heightMm: number): void {
  const item = getItemById(id);
  if (!item || !Number.isFinite(heightMm)) return;
  const aspect = item.widthMm / item.heightMm || 1;
  const h = Math.max(MIN_SIZE_MM, heightMm);
  const w = item.lockedAspectRatio ? Math.max(MIN_SIZE_MM, h * aspect) : item.widthMm;
  if (item.heightMm === h && item.widthMm === w) return;
  pushUndo();
  item.heightMm = h;
  if (item.lockedAspectRatio) {
    item.widthMm = w;
  }
  clampShapeAppearance(item);
  markDirty();
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

export function setLockedAspect(id: string, locked: boolean): void {
  const item = getItemById(id);
  if (!item || item.lockedAspectRatio === locked) return;
  pushUndo();
  item.lockedAspectRatio = locked;
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
  pushUndo();
  Object.assign(item, next);
  markDirty();
}

export function enterCropMode(id: string | null): void {
  doc.cropModeItemId = id;
}

export function exitCropMode(): void {
  doc.cropModeItemId = null;
}

// ── Zoom / Unit ───────────────────────────────────────────────────────

export function setZoom(zoom: number): void {
  if (!Number.isFinite(zoom)) return;
  doc.zoom = Math.round(Math.max(0.1, Math.min(5, zoom)) * 100) / 100;
}

export function setUnit(unit: Unit): void {
  doc.unit = unit;
}

// ── Persistence ───────────────────────────────────────────────────────

export function saveToLocalStorage(): void {
  try {
    const data = serializeDocument(doc);
    localStorage.setItem(LOCAL_STORAGE_KEY, data);
    markClean();
    showNotice("Project saved in this browser", "success");
  } catch {
    showNotice("Could not save: browser storage is unavailable or full", "error");
  }
}

export function loadFromLocalStorage(showFeedback = true): boolean {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!data) {
      if (showFeedback) showNotice("No saved project was found", "info");
      return false;
    }
    const parsed = normalizeDocument(JSON.parse(data));
    Object.assign(doc, parsed);
    clearHistory();
    markClean();
    if (showFeedback) showNotice("Saved project loaded", "success");
    return true;
  } catch {
    if (showFeedback) showNotice("The saved project is invalid or unreadable", "error");
    return false;
  }
}

export function requestLoadFromLocalStorage(): void {
  if (doc.dirty) confirmAction(() => loadFromLocalStorage());
  else loadFromLocalStorage();
}

export function exportJson(): string {
  return serializeDocument(doc, true);
}

export async function importJson(file: File): Promise<void> {
  const text = await file.text();
  const parsed = normalizeDocument(JSON.parse(text));
  Object.assign(doc, parsed);
  clearHistory();
  markClean();
  showNotice("Project imported", "success");
}

export function requestImportJson(file: File): void {
  const action = () => {
    importJson(file).catch(() => showNotice("The selected project file is invalid", "error"));
  };
  if (doc.dirty) confirmAction(action);
  else action();
}

function clearHistory(): void {
  undoStack = [];
  redoStack = [];
  pendingUndoSnapshot = null;
  syncUndoFlags();
}
