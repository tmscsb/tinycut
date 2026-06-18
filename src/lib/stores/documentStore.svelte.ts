import {
  type DocumentState,
  type ImageItem,
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

function markDirty(): void {
  doc.dirty = true;
}

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
  doc.page.widthMm = Math.max(10, widthMm);
  doc.page.heightMm = Math.max(10, heightMm);
  doc.page.templateId = "custom";
  doc.page.name = "Custom";
  markDirty();
}

export function selectItem(id: string | null): void {
  doc.selectedItemId = id;
  doc.cropModeItemId = null;
}

export function getSelectedItem(): ImageItem | null {
  if (!doc.selectedItemId) return null;
  return doc.items.find((i) => i.id === doc.selectedItemId) ?? null;
}

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

  doc.items.push(item);
  doc.selectedItemId = item.id;
  markDirty();
}

export function updateItem(id: string, patch: Partial<ImageItem>): void {
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  doc.items[idx] = { ...doc.items[idx], ...patch };
  markDirty();
}

export function deleteSelectedItem(): void {
  if (!doc.selectedItemId) return;
  doc.items = doc.items.filter((i) => i.id !== doc.selectedItemId);
  doc.selectedItemId = null;
  markDirty();
}

export function duplicateSelectedItem(): void {
  const item = getSelectedItem();
  if (!item) return;
  const clone: ImageItem = {
    ...item,
    id: createId("img"),
    name: item.name + " copy",
    xMm: item.xMm + 10,
    yMm: item.yMm + 10,
  };
  doc.items.push(clone);
  doc.selectedItemId = clone.id;
  markDirty();
}

export function moveItem(id: string, xMm: number, yMm: number): void {
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  doc.items[idx].xMm = xMm;
  doc.items[idx].yMm = yMm;
  markDirty();
}

export function nudgeItem(id: string, dxMm: number, dyMm: number): void {
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  doc.items[idx].xMm += dxMm;
  doc.items[idx].yMm += dyMm;
  markDirty();
}

function getVisibleAspect(item: ImageItem): number {
  const cropW = (item.crop.right - item.crop.left) * item.naturalWidthPx;
  const cropH = (item.crop.bottom - item.crop.top) * item.naturalHeightPx;
  if (cropH === 0) return 1;
  return cropW / cropH;
}

export function setItemWidth(id: string, widthMm: number): void {
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  const item = doc.items[idx];
  const w = Math.max(MIN_SIZE_MM, widthMm);
  doc.items[idx].widthMm = w;
  if (item.lockedAspectRatio) {
    const aspect = getVisibleAspect(item);
    doc.items[idx].heightMm = Math.max(MIN_SIZE_MM, w / aspect);
  }
  markDirty();
}

export function setItemHeight(id: string, heightMm: number): void {
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  const item = doc.items[idx];
  const h = Math.max(MIN_SIZE_MM, heightMm);
  doc.items[idx].heightMm = h;
  if (item.lockedAspectRatio) {
    const aspect = getVisibleAspect(item);
    doc.items[idx].widthMm = Math.max(MIN_SIZE_MM, h * aspect);
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
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  doc.items[idx].xMm = xMm;
  doc.items[idx].yMm = yMm;
  doc.items[idx].widthMm = Math.max(MIN_SIZE_MM, widthMm);
  doc.items[idx].heightMm = Math.max(MIN_SIZE_MM, heightMm);
  markDirty();
}

export function setItemX(id: string, xMm: number): void {
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  doc.items[idx].xMm = xMm;
  markDirty();
}

export function setItemY(id: string, yMm: number): void {
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  doc.items[idx].yMm = yMm;
  markDirty();
}

export function setCrop(id: string, crop: ImageCrop): void {
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  doc.items[idx].crop = { ...crop };
  markDirty();
}

export function resetCrop(id: string): void {
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  doc.items[idx].crop = { left: 0, top: 0, right: 1, bottom: 1 };
  markDirty();
}

export function enterCropMode(id: string | null): void {
  doc.cropModeItemId = id;
}

export function exitCropMode(): void {
  doc.cropModeItemId = null;
}

export function setZoom(zoom: number): void {
  doc.zoom = Math.max(0.1, Math.min(5, zoom));
}

export function setUnit(unit: Unit): void {
  doc.unit = unit;
}

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

export function clearLocalStorage(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
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

export function getItem(id: string): ImageItem | undefined {
  return doc.items.find((i) => i.id === id);
}
