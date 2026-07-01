import type { DocumentState } from "../types/document.ts";
import { exportDocumentAsSvg } from "./exportSvg.ts";

export const PNG_EXPORT_DPI = 600;

export async function exportDocumentAsPng(
  state: DocumentState,
  dpi = PNG_EXPORT_DPI,
): Promise<Blob> {
  const widthPx = Math.max(1, Math.round(state.page.widthMm * dpi / 25.4));
  const heightPx = Math.max(1, Math.round(state.page.heightMm * dpi / 25.4));
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

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("PNG encoding failed")),
        "image/png",
      );
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
