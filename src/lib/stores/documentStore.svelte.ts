import {
  type DocumentState,
  type DocumentItem,
  type ImageItem,
  type ShapeItem,
  type ShapeType,
  type ImageCrop,
  type Unit,
  PAGE_TEMPLATES,
  LOCAL_STORAGE_KEY,
  MIN_SIZE_MM,
} from "../types/document.ts";
import { createId } from "../utils/ids.ts";
import { loadImageFile } from "../utils/image.ts";
import { confirmAction } from "./uiStore.svelte.ts";

function defaultDoc(): DocumentState {
  const tpl = PAGE_TEMPLATES[0];
  return {
    page: { templateId: tpl.id, name: tpl.name, widthMm: tpl.widthMm, heightMm: tpl.heightMm },
    items: [],
    selectedItemId: null,
    zoom: 1,
    unit: "mm",
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

// ── Document ──────────────────────────────────────────────────────────

export function createNewDocument(templateId: string): void {
  const tpl = PAGE_TEMPLATES.find((t) => t.id === templateId);
  if (tpl) {
    Object.assign(doc, defaultDoc());
    doc.page = { templateId: tpl.id, name: tpl.name, widthMm: tpl.widthMm, heightMm: tpl.heightMm };
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

export function selectItem(id: string | null): void {
  doc.selectedItemId = id;
  doc.cropModeItemId = null;
}

// ── Images ────────────────────────────────────────────────────────────

export async function addImage(file: File): Promise<void> {
  const { src, naturalWidthPx, naturalHeightPx } = await loadImageFile(file);

  const aspect = naturalWidthPx / naturalHeightPx;
  const defaultWidthMm = 80;
  const defaultHeightMm = defaultWidthMm / aspect;

  const item: ImageItem = {
    id: createId("img"),
    type: "image",
    name: file.name,
    src,
    xMm: 10,
    yMm: 10,
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
  markDirty();
}

// ── Shapes ────────────────────────────────────────────────────────────

export function addShape(shapeType: ShapeType): void {
  const count = doc.items.filter((i) => i.type === "shape").length + 1;
  const name = shapeType.charAt(0).toUpperCase() + shapeType.slice(1);

  const item: ShapeItem = {
    id: createId("shp"),
    type: "shape",
    shapeType,
    name: `${name} ${count}`,
    xMm: 40,
    yMm: 40,
    widthMm: 80,
    heightMm: shapeType === "line" ? 60 : 60,
    rotationDeg: 0,
    lockedAspectRatio: false,
    fill: shapeType === "line" ? "none" : "#3b82f6",
    stroke: "#1e40af",
    strokeWidthMm: 1,
    cornerRadiusMm: 0,
  };

  pushUndo();
  doc.items.push(item);
  doc.selectedItemId = item.id;
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
  item.strokeWidthMm = Math.max(0, mm);
  markDirty();
}

export function setShapeCornerRadius(id: string, mm: number): void {
  const item = getItemById(id);
  if (!item || item.type !== "shape") return;
  pushUndo();
  item.cornerRadiusMm = Math.max(0, mm);
  markDirty();
}

// ── Generic Item Mutations ────────────────────────────────────────────

export function updateItem(id: string, patch: Partial<DocumentItem>): void {
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  doc.items[idx] = { ...doc.items[idx], ...patch };
  markDirty();
}

export function deleteSelectedItem(): void {
  if (!doc.selectedItemId) return;
  pushUndo();
  doc.items = doc.items.filter((i) => i.id !== doc.selectedItemId);
  doc.selectedItemId = null;
  markDirty();
}

export function duplicateSelectedItem(): void {
  const item = getSelectedItem();
  if (!item) return;

  const prefix = item.type === "image" ? "img" : "shp";
  const clone = { ...item, id: createId(prefix), name: item.name + " copy" };
  clone.xMm += 10;
  clone.yMm += 10;

  pushUndo();
  (doc.items as DocumentItem[]).push(clone);
  doc.selectedItemId = clone.id;
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

export function nudgeItem(id: string, dxMm: number, dyMm: number): void {
  const item = getItemById(id);
  if (!item) return;
  pushUndo();
  item.xMm += dxMm;
  item.yMm += dyMm;
  markDirty();
}

export function setItemWidth(id: string, widthMm: number): void {
  const item = getItemById(id);
  if (!item) return;
  pushUndo();
  const w = Math.max(MIN_SIZE_MM, widthMm);
  item.widthMm = w;
  if (item.type === "image" && item.lockedAspectRatio) {
    const aspect = getVisibleAspect(item);
    item.heightMm = Math.max(MIN_SIZE_MM, w / aspect);
  } else if (item.lockedAspectRatio) {
    const aspect = item.widthMm / item.heightMm;
    item.heightMm = Math.max(MIN_SIZE_MM, w / aspect);
  }
  markDirty();
}

export function setItemHeight(id: string, heightMm: number): void {
  const item = getItemById(id);
  if (!item) return;
  pushUndo();
  const h = Math.max(MIN_SIZE_MM, heightMm);
  item.heightMm = h;
  if (item.lockedAspectRatio) {
    const aspect = item.widthMm / item.heightMm || 1;
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
  item.crop = { ...crop };
  markDirty();
}

export function resetCrop(id: string): void {
  const item = getItemById(id);
  if (!item || item.type !== "image") return;
  pushUndo();
  item.crop = { left: 0, top: 0, right: 1, bottom: 1 };
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
  } catch {
    // Storage full or unavailable
  }
}

export function loadFromLocalStorage(): boolean {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!data) return false;
    const parsed = JSON.parse(data) as DocumentState;
    Object.assign(doc, parsed);
    doc.dirty = false;
    return true;
  } catch {
    return false;
  }
}

export function exportJson(): string {
  return JSON.stringify(doc, null, 2);
}

export async function importJson(file: File): Promise<void> {
  const text = await file.text();
  const parsed = JSON.parse(text) as DocumentState;
  Object.assign(doc, parsed);
  doc.dirty = false;
}
