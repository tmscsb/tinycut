import type { DocumentState, Page } from "../types/document.ts";
import { exportDocumentAsSvg } from "./exportSvg.ts";
import { setPngDensity } from "./pngMetadata.ts";

export const PNG_EXPORT_DPI = 600;
export const MAX_PNG_EXPORT_PIXELS = 100_000_000;
export const MAX_PNG_EXPORT_DIMENSION = 32_767;

export function getPngExportDimensions(page: Pick<Page, "widthMm" | "heightMm">, dpi: number) {
  const widthPx = Math.max(1, Math.round(page.widthMm * dpi / 25.4));
  const heightPx = Math.max(1, Math.round(page.heightMm * dpi / 25.4));
  return {
    widthPx,
    heightPx,
    pixelCount: widthPx * heightPx,
    supported:
      Number.isFinite(dpi) &&
      dpi > 0 &&
      Number.isFinite(page.widthMm) && page.widthMm > 0 &&
      Number.isFinite(page.heightMm) && page.heightMm > 0 &&
      widthPx <= MAX_PNG_EXPORT_DIMENSION &&
      heightPx <= MAX_PNG_EXPORT_DIMENSION &&
      widthPx * heightPx <= MAX_PNG_EXPORT_PIXELS,
  };
}

export async function exportDocumentAsPng(
  state: DocumentState,
  dpi = PNG_EXPORT_DPI,
): Promise<Blob> {
  const dimensions = getPngExportDimensions(state.page, dpi);
  if (!dimensions.supported) {
    throw new Error("The requested PNG is too large for a reliable browser export");
  }
  const { widthPx, heightPx } = dimensions;
  const svgBlob = new Blob([exportDocumentAsSvg(state)], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    image.decoding = "sync";
    image.src = svgUrl;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas rendering is unavailable");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, widthPx, heightPx);
    context.drawImage(image, 0, 0, widthPx, heightPx);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("PNG encoding failed")),
        "image/png",
      );
    });
    const png = setPngDensity(new Uint8Array(await blob.arrayBuffer()), dpi);
    return new Blob([png], { type: "image/png" });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
