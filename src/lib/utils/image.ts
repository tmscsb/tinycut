import { MAX_IMAGE_FILE_BYTES } from "../types/document.ts";
import { isImageMime, type ImageMime } from "./assets.ts";

export async function loadImageFile(file: File): Promise<{
  blob: Blob;
  mime: ImageMime;
  naturalWidthPx: number;
  naturalHeightPx: number;
}> {
  const mime = file.type;
  if (!isImageMime(mime)) {
    throw new Error("Choose a PNG, JPG, WebP, or SVG image.");
  }
  if (file.size > MAX_IMAGE_FILE_BYTES) throw new Error("Images must be 20 MB or smaller.");

  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { img.src = ""; reject(new Error("The image took too long to load.")); }, 15_000);
      img.onload = () => { clearTimeout(timer); resolve(); };
      img.onerror = () => { clearTimeout(timer); reject(new Error("This image is damaged or cannot be opened.")); };
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }

  if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    throw new Error("Image dimensions are invalid");
  }
  if (img.naturalWidth * img.naturalHeight > 64_000_000) throw new Error("Images must be 64 megapixels or smaller.");

  return {
    blob: file,
    mime,
    naturalWidthPx: img.naturalWidth,
    naturalHeightPx: img.naturalHeight,
  };
}
