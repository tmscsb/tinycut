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
import {
  applyCropToImageFrame,
  migrateLegacyCropGeometry,
  normalizeCrop,
} from "../utils/cropGeometry.ts";

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

export const undoState = $state({ hasUndo: false, hasRedo: false });

function syncUndoFlags(): void {
  undoState.hasUndo = undoStack.length > 0;
  undoState.hasRedo = redoStack.length > 0;
}

export function beginUndo(): void {
  pushUndo();
}

function pushUndo(): void {
  undoStack.push(JSON.stringify(doc));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack = [];
  syncUndoFlags();
}

export function undo(): void {
  if (undoStack.length === 0) return;
  redoStack.push(JSON.stringify(doc));
  const snapshot = JSON.parse(undoStack.pop()!) as DocumentState;
  Object.assign(doc, snapshot);
  syncUndoFlags();
}

export function redo(): void {
  if (redoStack.length === 0) return;
  undoStack.push(JSON.stringify(doc));
  const snapshot = JSON.parse(redoStack.pop()!) as DocumentState;
  Object.assign(doc, snapshot);
  syncUndoFlags();
}

// ── Helpers ───────────────────────────────────────────────────────────

function markDirty(): void {
  doc.dirty = true;
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

function getVisibleAspect(item: ImageItem): number {
  const cropW = (item.crop.right - item.crop.left) * item.naturalWidthPx;
  const cropH = (item.crop.bottom - item.crop.top) * item.naturalHeightPx;
  if (cropH === 0) return 1;
  return cropW / cropH;
}

function normalizeRotation(degrees: number): number {
  return Math.round((((degrees % 360) + 360) % 360) * 100) / 100;
}

// ── Document ──────────────────────────────────────────────────────────

export function createNewDocument(templateId: string): void {
  const tpl = PAGE_TEMPLATES.find((t) => t.id === templateId);
  if (tpl) {
    Object.assign(doc, defaultDoc());
    doc.page = { templateId: tpl.id, name: tpl.name, widthMm: tpl.widthMm, heightMm: tpl.heightMm };
    clearHistory();
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
  pushUndo();
  doc.page.widthMm = Math.max(10, widthMm);
  doc.page.heightMm = Math.max(10, heightMm);
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

  const item: ShapeItem = {
    id: createId("shp"),
    type: "shape",
    shapeType,
    name: `${name} ${count}`,
    xMm: 40,
    yMm: 40,
    widthMm: shapeType === "ellipse" ? 60 : 80,
    heightMm: 60,
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
  const item: TextItem = {
    id: createId("txt"),
    type: "text",
    name: `Text ${count}`,
    text: "Edit this text",
    xMm: 30,
    yMm: 30,
    widthMm: Math.max(20, Math.min(100, doc.page.widthMm - 40)),
    heightMm: 20,
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
  pushUndo();
  Object.assign(item, patch);
  markDirty();
}

export function setShapeFill(id: string, fill: string): void {
  const item = getItemById(id);
  if (!item || item.type !== "shape") return;
  pushUndo();
  item.fill = fill;
  markDirty();
}

export function setShapeStroke(id: string, stroke: string): void {
  const item = getItemById(id);
  if (!item || item.type !== "shape") return;
  pushUndo();
  item.stroke = stroke;
  markDirty();
}

export function setShapeStrokeWidth(id: string, mm: number): void {
  const item = getItemById(id);
  if (!item || item.type !== "shape") return;
  pushUndo();
  const maxStroke = item.shapeType === "line" ? Math.max(item.widthMm, item.heightMm) : Math.min(item.widthMm, item.heightMm);
  item.strokeWidthMm = Math.max(0, Math.min(maxStroke, mm));
  markDirty();
}

export function setShapeCornerRadius(id: string, mm: number): void {
  const item = getItemById(id);
  if (!item || item.type !== "shape") return;
  pushUndo();
  item.cornerRadiusMm = Math.max(0, Math.min(Math.min(item.widthMm, item.heightMm) / 2, mm));
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

export function moveItem(id: string, xMm: number, yMm: number): void {
  const item = getItemById(id);
  if (!item) return;
  item.xMm = xMm;
  item.yMm = yMm;
  markDirty();
}

export function moveItemsByDelta(
  ids: string[],
  dxMm: number,
  dyMm: number,
  starts: Record<string, { xMm: number; yMm: number }>,
): void {
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
  Object.assign(doc, patch);
  doc.gridSizeMm = Math.max(1, doc.gridSizeMm);
  markDirty();
}

export function setItemWidth(id: string, widthMm: number): void {
  const item = getItemById(id);
  if (!item) return;
  pushUndo();
  const aspect = item.widthMm / item.heightMm || 1;
  const w = Math.max(MIN_SIZE_MM, widthMm);
  item.widthMm = w;
  if (item.lockedAspectRatio) {
    item.heightMm = Math.max(MIN_SIZE_MM, w / aspect);
  }
  markDirty();
}

export function setItemHeight(id: string, heightMm: number): void {
  const item = getItemById(id);
  if (!item) return;
  pushUndo();
  const aspect = item.widthMm / item.heightMm || 1;
  const h = Math.max(MIN_SIZE_MM, heightMm);
  item.heightMm = h;
  if (item.lockedAspectRatio) {
    item.widthMm = Math.max(MIN_SIZE_MM, h * aspect);
  }
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
  if (!item) return;
  item.xMm = xMm;
  item.yMm = yMm;
  item.widthMm = Math.max(MIN_SIZE_MM, widthMm);
  item.heightMm = Math.max(MIN_SIZE_MM, heightMm);
  markDirty();
}

export function setItemX(id: string, xMm: number): void {
  const item = getItemById(id);
  if (!item) return;
  pushUndo();
  item.xMm = xMm;
  markDirty();
}

export function setItemY(id: string, yMm: number): void {
  const item = getItemById(id);
  if (!item) return;
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
  if (!item) return;
  pushUndo();
  item.lockedAspectRatio = locked;
  markDirty();
}

// ── Crop ──────────────────────────────────────────────────────────────

export function setCrop(id: string, crop: ImageCrop): void {
  const item = getItemById(id);
  if (!item || item.type !== "image") return;
  pushUndo();
  Object.assign(item, applyCropToImageFrame(item, crop));
  markDirty();
}

export function updateCrop(id: string, crop: ImageCrop): void {
  const item = getItemById(id);
  if (!item || item.type !== "image") return;
  Object.assign(item, applyCropToImageFrame(item, crop));
  markDirty();
}

export function resetCrop(id: string): void {
  const item = getItemById(id);
  if (!item || item.type !== "image") return;
  pushUndo();
  Object.assign(item, applyCropToImageFrame(item, { left: 0, top: 0, right: 1, bottom: 1 }));
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
  doc.zoom = Math.max(0.1, Math.min(5, zoom));
}

export function setUnit(unit: Unit): void {
  doc.unit = unit;
}

// ── Persistence ───────────────────────────────────────────────────────

export function saveToLocalStorage(): void {
  try {
    const data = JSON.stringify(doc);
    localStorage.setItem(LOCAL_STORAGE_KEY, data);
    doc.dirty = false;
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
    doc.dirty = false;
    clearHistory();
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
  return JSON.stringify(doc, null, 2);
}

export async function importJson(file: File): Promise<void> {
  const text = await file.text();
  const parsed = normalizeDocument(JSON.parse(text));
  Object.assign(doc, parsed);
  doc.dirty = false;
  clearHistory();
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
  syncUndoFlags();
}

function normalizeDocument(value: unknown): DocumentState {
  if (!value || typeof value !== "object") throw new Error("Invalid project file");
  const input = value as Partial<DocumentState> & { version?: number };
  if (!input.page || !Array.isArray(input.items)) throw new Error("Invalid project file");
  if (!Number.isFinite(input.page.widthMm) || !Number.isFinite(input.page.heightMm)) {
    throw new Error("Invalid page dimensions");
  }

  const legacy = input.version !== 2;
  const items = input.items.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      (item.type !== "image" && item.type !== "shape" && item.type !== "text")
    ) {
      throw new Error("Invalid project item");
    }
    if (![item.xMm, item.yMm, item.widthMm, item.heightMm].every(Number.isFinite)) {
      throw new Error("Invalid item dimensions");
    }
    if (item.type === "image") {
      const normalized = { ...item, crop: normalizeCrop(item.crop ?? { left: 0, top: 0, right: 1, bottom: 1 }) };
      normalized.rotationDeg = normalizeRotation(Number(normalized.rotationDeg) || 0);
      return legacy ? migrateLegacyCropGeometry(normalized) : normalized;
    }
    return { ...item, rotationDeg: normalizeRotation(Number(item.rotationDeg) || 0) };
  });

  return {
    version: 2,
    page: {
      templateId: String(input.page.templateId ?? "custom"),
      name: String(input.page.name ?? "Custom"),
      widthMm: Math.max(10, input.page.widthMm),
      heightMm: Math.max(10, input.page.heightMm),
    },
    items,
    selectedItemId: null,
    selectedItemIds: [],
    zoom: Number.isFinite(input.zoom) ? Math.max(0.1, Math.min(5, input.zoom!)) : 1,
    unit: input.unit === "cm" ? "cm" : "mm",
    gridSizeMm: Number.isFinite(input.gridSizeMm) ? Math.max(1, input.gridSizeMm!) : 5,
    showGrid: input.showGrid === true,
    snapToGrid: input.snapToGrid === true,
    showGuides: input.showGuides === true,
    cropModeItemId: null,
    dirty: false,
  };
}
