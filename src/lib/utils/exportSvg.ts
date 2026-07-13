import type { DocumentState, DocumentItem, ImageItem, ShapeItem, TextItem } from "../types/document.ts";

export function exportDocumentAsSvg(state: DocumentState): string {
  const { page, items } = state;

  let inner = "";

  for (const [index, item] of items.entries()) {
    inner += renderItemToSvg(item, index);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  width="${page.widthMm}mm"
  height="${page.heightMm}mm"
  viewBox="0 0 ${page.widthMm} ${page.heightMm}"
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
>
  <rect width="${page.widthMm}" height="${page.heightMm}" fill="white" />
  ${inner}
</svg>`;
}

function renderItemToSvg(item: DocumentItem, index: number): string {
  const content = item.type === "image"
    ? renderImageToSvg(item, index)
    : item.type === "shape" ? renderShapeToSvg(item) : renderTextToSvg(item);
  const centerX = item.xMm + item.widthMm / 2;
  const centerY = item.yMm + item.heightMm / 2;
  const transform = item.rotationDeg
    ? ` transform="rotate(${item.rotationDeg} ${centerX} ${centerY})"`
    : "";
  return `\n  <g id="layer-${index}-${safeId(item.id)}" data-layer-index="${index}" data-item-type="${item.type}" inkscape:groupmode="layer" inkscape:label="${escapeXml(item.name)}"${transform}>${content}\n  </g>`;
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "-");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderTextToSvg(item: TextItem): string {
  return `
  <foreignObject x="${item.xMm}" y="${item.yMm}" width="${item.widthMm}" height="${item.heightMm}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;box-sizing:border-box;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere;font-family:${escapeXml(item.fontFamily)};font-size:${item.fontSizeMm}px;font-weight:${item.fontWeight};line-height:1.2;text-align:${item.textAlign};color:${item.color};">${escapeXml(item.text)}</div>
  </foreignObject>`;
}

function renderImageToSvg(item: ImageItem, index: number): string {
  const crop = item.crop;
  const cropX = crop.left * item.naturalWidthPx;
  const cropY = crop.top * item.naturalHeightPx;
  const cropW = (crop.right - crop.left) * item.naturalWidthPx;
  const cropH = (crop.bottom - crop.top) * item.naturalHeightPx;

  const hasCrop = crop.left !== 0 || crop.top !== 0 || crop.right !== 1 || crop.bottom !== 1;

  if (hasCrop) {
    const scaleX = item.widthMm / cropW;
    const scaleY = item.heightMm / cropH;
    const imageX = item.xMm - cropX * scaleX;
    const imageY = item.yMm - cropY * scaleY;
    const clipId = `clip-${index}-${safeId(item.id)}`;
    return `
    <defs>
      <clipPath id="${clipId}">
        <rect x="${item.xMm}" y="${item.yMm}" width="${item.widthMm}" height="${item.heightMm}" />
      </clipPath>
    </defs>
    <image
      href="${escapeXml(item.src)}"
      xlink:href="${escapeXml(item.src)}"
      x="${imageX}"
      y="${imageY}"
      width="${item.naturalWidthPx * scaleX}"
      height="${item.naturalHeightPx * scaleY}"
      preserveAspectRatio="none"
      clip-path="url(#${clipId})"
    />
  `;
  }

  return `
  <image
    href="${escapeXml(item.src)}"
    xlink:href="${escapeXml(item.src)}"
    x="${item.xMm}"
    y="${item.yMm}"
    width="${item.widthMm}"
    height="${item.heightMm}"
    preserveAspectRatio="none"
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
