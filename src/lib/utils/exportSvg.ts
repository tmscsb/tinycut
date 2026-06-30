import type { DocumentState, DocumentItem, ImageItem, ShapeItem } from "../types/document.ts";

export function exportDocumentAsSvg(state: DocumentState): string {
  const { page, items } = state;

  let inner = "";

  for (const item of items) {
    inner += renderItemToSvg(item);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  width="${page.widthMm}mm"
  height="${page.heightMm}mm"
  viewBox="0 0 ${page.widthMm} ${page.heightMm}"
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
>
  <rect width="${page.widthMm}" height="${page.heightMm}" fill="white" />
  ${inner}
</svg>`;
}

function renderItemToSvg(item: DocumentItem): string {
  if (item.type === "image") return renderImageToSvg(item);
  if (item.type === "shape") return renderShapeToSvg(item);
  return "";
}

function renderImageToSvg(item: ImageItem): string {
  const crop = item.crop;
  const cropX = crop.left * item.naturalWidthPx;
  const cropY = crop.top * item.naturalHeightPx;
  const cropW = (crop.right - crop.left) * item.naturalWidthPx;
  const cropH = (crop.bottom - crop.top) * item.naturalHeightPx;

  const hasCrop = crop.left !== 0 || crop.top !== 0 || crop.right !== 1 || crop.bottom !== 1;

  if (hasCrop) {
    const cropFracW = crop.right - crop.left;
    const cropFracH = crop.bottom - crop.top;
    const outX = item.xMm + crop.left * item.widthMm;
    const outY = item.yMm + crop.top * item.heightMm;
    const outW = cropFracW * item.widthMm;
    const outH = cropFracH * item.heightMm;

    return `
  <svg
    x="${outX}"
    y="${outY}"
    width="${outW}"
    height="${outH}"
    viewBox="${cropX} ${cropY} ${cropW} ${cropH}"
  >
    <image
      href="${item.src}"
      x="0"
      y="0"
      width="${item.naturalWidthPx}"
      height="${item.naturalHeightPx}"
    />
  </svg>`;
  }

  return `
  <image
    href="${item.src}"
    x="${item.xMm}"
    y="${item.yMm}"
    width="${item.widthMm}"
    height="${item.heightMm}"
  />`;
}

function renderShapeToSvg(item: ShapeItem): string {
  const sw = item.strokeWidthMm;
  if (item.shapeType === "rect") {
    return `
  <rect
    x="${item.xMm + sw / 2}"
    y="${item.yMm + sw / 2}"
    width="${item.widthMm - sw}"
    height="${item.heightMm - sw}"
    rx="${item.cornerRadiusMm}"
    fill="${item.fill}"
    stroke="${item.stroke}"
    stroke-width="${sw}"
  />`;
  }
  if (item.shapeType === "ellipse") {
    const cx = item.xMm + item.widthMm / 2;
    const cy = item.yMm + item.heightMm / 2;
    return `
  <ellipse
    cx="${cx}"
    cy="${cy}"
    rx="${item.widthMm / 2 - sw / 2}"
    ry="${item.heightMm / 2 - sw / 2}"
    fill="${item.fill}"
    stroke="${item.stroke}"
    stroke-width="${sw}"
  />`;
  }
  if (item.shapeType === "line") {
    return `
  <line
    x1="${item.xMm + sw / 2}"
    y1="${item.yMm + sw / 2}"
    x2="${item.xMm + item.widthMm - sw / 2}"
    y2="${item.yMm + item.heightMm - sw / 2}"
    stroke="${item.stroke}"
    stroke-width="${sw}"
    stroke-linecap="round"
  />`;
  }
  return "";
}
