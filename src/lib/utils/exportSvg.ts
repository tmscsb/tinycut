import type { DocumentState, ImageItem } from "../types/document.ts";

export function exportDocumentAsSvg(state: DocumentState): string {
  const { page, items } = state;

  let inner = "";

  for (const item of items) {
    inner += renderImageToSvg(item);
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
