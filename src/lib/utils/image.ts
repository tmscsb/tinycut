import { MAX_IMAGE_FILE_BYTES } from "../types/document.ts";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function loadImageFile(file: File): Promise<{
  src: string;
  naturalWidthPx: number;
  naturalHeightPx: number;
}> {
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
    throw new Error("Choose a PNG, JPG, WebP, or SVG image.");
  }
  if (file.size > MAX_IMAGE_FILE_BYTES) throw new Error("Images must be 20 MB or smaller.");
  const src = await fileToDataUrl(file);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { img.src = ""; reject(new Error("The image took too long to load.")); }, 15_000);
    img.onload = () => { clearTimeout(timer); resolve(); };
    img.onerror = () => { clearTimeout(timer); reject(new Error("This image is damaged or cannot be opened.")); };
    img.src = src;
  });

  if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    throw new Error("Image dimensions are invalid");
  }
  if (img.naturalWidth * img.naturalHeight > 64_000_000) throw new Error("Images must be 64 megapixels or smaller.");

  return {
    src,
    naturalWidthPx: img.naturalWidth,
    naturalHeightPx: img.naturalHeight,
  };
}
