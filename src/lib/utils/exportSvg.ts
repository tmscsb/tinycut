import type { DocumentState, DocumentItem, ImageItem, ShapeItem, TextItem } from "../types/document.ts";

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
  const content = item.type === "image"
    ? renderImageToSvg(item)
    : item.type === "shape" ? renderShapeToSvg(item) : renderTextToSvg(item);
  if (!item.rotationDeg) return content;
  const centerX = item.xMm + item.widthMm / 2;
  const centerY = item.yMm + item.heightMm / 2;
  return `\n  <g transform="rotate(${item.rotationDeg} ${centerX} ${centerY})">${content}\n  </g>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderTextToSvg(item: TextItem): string {
  const anchor = item.textAlign === "center" ? "middle" : item.textAlign === "right" ? "end" : "start";
  const x = item.textAlign === "center"
    ? item.xMm + item.widthMm / 2
    : item.textAlign === "right" ? item.xMm + item.widthMm : item.xMm;
  const lines = item.text.split("\n");
  const tspans = lines.map((line, index) =>
    `<tspan x="${x}" dy="${index === 0 ? 0 : item.fontSizeMm * 1.2}">${escapeXml(line)}</tspan>`,
  ).join("");
  return `
  <text
    x="${x}"
    y="${item.yMm + item.fontSizeMm}"
    fill="${item.color}"
    font-family="${escapeXml(item.fontFamily)}"
    font-size="${item.fontSizeMm}"
    font-weight="${item.fontWeight}"
    text-anchor="${anchor}"
  >${tspans}</text>`;
}

function renderImageToSvg(item: ImageItem): string {
  const crop = item.crop;
  const cropX = crop.left * item.naturalWidthPx;
  const cropY = crop.top * item.naturalHeightPx;
  const cropW = (crop.right - crop.left) * item.naturalWidthPx;
  const cropH = (crop.bottom - crop.top) * item.naturalHeightPx;

  const hasCrop = crop.left !== 0 || crop.top !== 0 || crop.right !== 1 || crop.bottom !== 1;

  if (hasCrop) {
    return `
  <svg
    x="${item.xMm}"
    y="${item.yMm}"
    width="${item.widthMm}"
    height="${item.heightMm}"
    viewBox="${cropX} ${cropY} ${cropW} ${cropH}"
    preserveAspectRatio="none"
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
