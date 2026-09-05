import {
  type DocumentState,
  type DocumentItem,
  type ImageCrop,
  type ImageItem,
  type ShapeItem,
  type ShapeType,
  type TextItem,
  MIN_SIZE_MM,
  MAX_PAGE_SIZE_MM,
  MAX_DOCUMENT_ITEMS,
  PAGE_TEMPLATES,
} from "../types/document.ts";
import { migrateLegacyCropGeometry, normalizeCrop } from "./cropGeometry.ts";

const SHAPE_TYPES = new Set<ShapeType>(["rect", "ellipse", "line"]);
const FONT_FAMILIES = new Set([
  "Arial, sans-serif",
  "Georgia, serif",
  "'Courier New', monospace",
]);

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object");
  }
  return value as Record<string, unknown>;
}

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function requiredFinite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function color(value: unknown, fallback: string, allowNone = false): string {
  if (allowNone && value === "none") return "none";
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
}

export function normalizeRotation(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  return (Math.round((((degrees % 360) + 360) % 360) * 100) / 100) % 360;
}

function uniqueId(value: unknown, index: number, usedIds: Set<string>): string {
  const requested = typeof value === "string" && value.trim() ? value.trim() : `item-${index + 1}`;
  let id = requested;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${requested}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function normalizeCommonItem(
  value: Record<string, unknown>,
  index: number,
  usedIds: Set<string>,
) {
  return {
    id: uniqueId(value.id, index, usedIds),
    name: text(value.name, `Item ${index + 1}`).slice(0, 240),
    xMm: requiredFinite(value.xMm, "item X position"),
    yMm: requiredFinite(value.yMm, "item Y position"),
    widthMm: Math.max(MIN_SIZE_MM, requiredFinite(value.widthMm, "item width")),
    heightMm: Math.max(MIN_SIZE_MM, requiredFinite(value.heightMm, "item height")),
    rotationDeg: normalizeRotation(finite(value.rotationDeg, 0)),
  };
}

function normalizeImage(
  value: Record<string, unknown>,
  index: number,
  usedIds: Set<string>,
  legacy: boolean,
): ImageItem {
  const common = normalizeCommonItem(value, index, usedIds);
  const cropValue = value.crop && typeof value.crop === "object"
    ? value.crop as Partial<ImageCrop>
    : {};
  const item: ImageItem = {
    ...common,
    type: "image",
    src: text(value.src, ""),
    naturalWidthPx: Math.max(1, requiredFinite(value.naturalWidthPx, "image width")),
    naturalHeightPx: Math.max(1, requiredFinite(value.naturalHeightPx, "image height")),
    lockedAspectRatio: value.lockedAspectRatio !== false,
    crop: normalizeCrop({
      left: finite(cropValue.left, 0),
      top: finite(cropValue.top, 0),
      right: finite(cropValue.right, 1),
      bottom: finite(cropValue.bottom, 1),
    }),
  };
  if (!/^data:image\/(png|jpeg|webp|svg\+xml)(;[^,]*)?,/i.test(item.src)) throw new Error("Invalid image source");
  return legacy ? migrateLegacyCropGeometry(item) : item;
}

function normalizeShape(
  value: Record<string, unknown>,
  index: number,
  usedIds: Set<string>,
): ShapeItem {
  const common = normalizeCommonItem(value, index, usedIds);
  const shapeType = SHAPE_TYPES.has(value.shapeType as ShapeType)
    ? value.shapeType as ShapeType
    : "rect";
  const maxStroke = Math.min(common.widthMm, common.heightMm);
  return {
    ...common,
    type: "shape",
    shapeType,
    lockedAspectRatio: value.lockedAspectRatio === true,
    fill: shapeType === "line" ? "none" : color(value.fill, "#3b82f6", true),
    stroke: color(value.stroke, "#1e40af"),
    strokeWidthMm: Math.max(0, Math.min(maxStroke, finite(value.strokeWidthMm, 1))),
    cornerRadiusMm: Math.max(
      0,
      Math.min(Math.min(common.widthMm, common.heightMm) / 2, finite(value.cornerRadiusMm, 0)),
    ),
  };
}

function normalizeText(
  value: Record<string, unknown>,
  index: number,
  usedIds: Set<string>,
): TextItem {
  const common = normalizeCommonItem(value, index, usedIds);
  const fontFamily = text(value.fontFamily, "Arial, sans-serif");
  const fontWeight = value.fontWeight === "600" || value.fontWeight === "700"
    ? value.fontWeight
    : "400";
  const textAlign = value.textAlign === "center" || value.textAlign === "right"
    ? value.textAlign
    : "left";
  return {
    ...common,
    type: "text",
    text: text(value.text, ""),
    lockedAspectRatio: false,
    fontSizeMm: Math.max(1, finite(value.fontSizeMm, 6)),
    fontFamily: FONT_FAMILIES.has(fontFamily) ? fontFamily : "Arial, sans-serif",
    fontWeight,
    textAlign,
    color: color(value.color, "#111827"),
  };
}

export function normalizeDocument(value: unknown): DocumentState {
  const input = asRecord(value);
  if (input.version !== undefined && input.version !== 1 && input.version !== 2) {
    throw new Error("This project was made with an unsupported version of TrimKit.");
  }
  const page = asRecord(input.page);
  if (!Array.isArray(input.items)) throw new Error("Invalid project items");
  if (input.items.length > MAX_DOCUMENT_ITEMS) throw new Error("Projects can contain up to 1,000 items.");

  const widthMm = Math.max(10, requiredFinite(page.widthMm, "page width"));
  const heightMm = Math.max(10, requiredFinite(page.heightMm, "page height"));
  if (widthMm > MAX_PAGE_SIZE_MM || heightMm > MAX_PAGE_SIZE_MM) throw new Error("Page dimensions cannot exceed 2,000 mm.");
  const template = PAGE_TEMPLATES.find((candidate) => candidate.id === page.templateId && candidate.widthMm === widthMm && candidate.heightMm === heightMm);
  const legacy = input.version !== 2;
  const usedIds = new Set<string>();
  const items: DocumentItem[] = input.items.map((rawItem, index) => {
    const item = asRecord(rawItem);
    if (item.type === "image") return normalizeImage(item, index, usedIds, legacy);
    if (item.type === "shape") return normalizeShape(item, index, usedIds);
    if (item.type === "text") return normalizeText(item, index, usedIds);
    throw new Error("Invalid project item type");
  });

  return {
    version: 2,
    page: {
      templateId: template?.id ?? "custom",
      name: template?.name ?? text(page.name, "Custom").slice(0, 120),
      widthMm,
      heightMm,
    },
    items,
    selectedItemId: null,
    selectedItemIds: [],
    zoom: Math.max(0.1, Math.min(5, finite(input.zoom, 1))),
    unit: input.unit === "cm" ? "cm" : "mm",
    gridSizeMm: Math.max(1, finite(input.gridSizeMm, 5)),
    showGrid: input.showGrid === true,
    snapToGrid: input.snapToGrid === true,
    showGuides: input.showGuides === true,
    cropModeItemId: null,
    dirty: false,
  };
}

export function getDocumentContentSnapshot(state: DocumentState): string {
  return JSON.stringify({
    page: state.page,
    items: state.items,
    gridSizeMm: state.gridSizeMm,
    showGrid: state.showGrid,
    snapToGrid: state.snapToGrid,
    showGuides: state.showGuides,
  });
}

export function serializeDocument(state: DocumentState, pretty = false): string {
  const persisted: DocumentState = {
    ...state,
    selectedItemId: null,
    selectedItemIds: [],
    cropModeItemId: null,
    dirty: false,
  };
  return JSON.stringify(persisted, null, pretty ? 2 : undefined);
}
