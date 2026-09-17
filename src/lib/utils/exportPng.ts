import type { DocumentState, Page } from "../types/document.ts";
import { exportDocumentAsSvg } from "./exportSvg.ts";
import { setPngDensity } from "./pngMetadata.ts";

export const PNG_EXPORT_DPI = 300;
export const JPEG_EXPORT_QUALITY = 0.9;
export const MAX_PNG_EXPORT_PIXELS = 100_000_000;
export const MAX_PNG_EXPORT_DIMENSION = 32_767;

export type RasterExportFormat = "png" | "jpeg";

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
  return exportDocumentAsRaster(state, { dpi, format: "png" });
}

export async function exportDocumentAsRaster(
  state: DocumentState,
  options: { dpi?: number; format?: RasterExportFormat; quality?: number } = {},
): Promise<Blob> {
  const dpi = options.dpi ?? PNG_EXPORT_DPI;
  const format = options.format ?? "png";
  const quality = options.quality ?? JPEG_EXPORT_QUALITY;
  const dimensions = getPngExportDimensions(state.page, dpi);
  if (!dimensions.supported) {
    throw new Error("The requested image is too large for a reliable browser export");
  }
  const { widthPx, heightPx } = dimensions;
  const svgBlob = new Blob(
    [exportDocumentAsSvg(state, { width: `${widthPx}px`, height: `${heightPx}px` })],
    { type: "image/svg+xml;charset=utf-8" },
  );
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("SVG raster timed out")), 15_000);
      image.onload = () => { window.clearTimeout(timer); resolve(); };
      image.onerror = () => { window.clearTimeout(timer); reject(new Error("SVG raster failed")); };
      image.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas rendering is unavailable");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, widthPx, heightPx);
    context.drawImage(image, 0, 0, widthPx, heightPx);

    const mime = format === "jpeg" ? "image/jpeg" : "image/png";
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Image encoding failed")),
        mime,
        format === "jpeg" ? quality : undefined,
      );
    });
    if (format !== "png") return blob;
    const png = setPngDensity(new Uint8Array(await blob.arrayBuffer()), dpi);
    return new Blob([png], { type: "image/png" });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
