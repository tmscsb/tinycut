export type Unit = "mm" | "cm";

export type PageTemplate = {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
};

export type ImageCrop = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type ImageItem = {
  id: string;
  type: "image";
  name: string;
  src: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  naturalWidthPx: number;
  naturalHeightPx: number;
  rotationDeg: number;
  lockedAspectRatio: boolean;
  crop: ImageCrop;
};

export type ShapeType = "rect" | "ellipse" | "line";

export type ShapeItem = {
  id: string;
  type: "shape";
  shapeType: ShapeType;
  name: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotationDeg: number;
  lockedAspectRatio: boolean;
  fill: string;
  stroke: string;
  strokeWidthMm: number;
  cornerRadiusMm: number;
};

export type DocumentItem = ImageItem | ShapeItem;

export type Page = {
  templateId: string;
  name: string;
  widthMm: number;
  heightMm: number;
};

export type DocumentState = {
  page: Page;
  items: DocumentItem[];
  selectedItemId: string | null;
  zoom: number;
  unit: Unit;
  cropModeItemId: string | null;
  dirty: boolean;
};

export const PAGE_TEMPLATES: PageTemplate[] = [
  { id: "a4-portrait", name: "A4 Portrait", widthMm: 210, heightMm: 297 },
  { id: "a4-landscape", name: "A4 Landscape", widthMm: 297, heightMm: 210 },
  { id: "a5-portrait", name: "A5 Portrait", widthMm: 148, heightMm: 210 },
  { id: "a5-landscape", name: "A5 Landscape", widthMm: 210, heightMm: 148 },
  { id: "a6-portrait", name: "A6 Portrait", widthMm: 105, heightMm: 148 },
  { id: "letter-portrait", name: "Letter Portrait", widthMm: 215.9, heightMm: 279.4 },
];

export const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.5, 2];

export const LOCAL_STORAGE_KEY = "trimkit-document";

export const MIN_SIZE_MM = 5;
