import type { ImageCrop, ImageItem } from "../types/document.ts";

const MIN_CROP_FRACTION = 0.01;

export function normalizeCrop(crop: ImageCrop): ImageCrop {
  let left = Number.isFinite(crop.left) ? Math.max(0, Math.min(1, crop.left)) : 0;
  let top = Number.isFinite(crop.top) ? Math.max(0, Math.min(1, crop.top)) : 0;
  let right = Number.isFinite(crop.right) ? Math.max(0, Math.min(1, crop.right)) : 1;
  let bottom = Number.isFinite(crop.bottom) ? Math.max(0, Math.min(1, crop.bottom)) : 1;

  if (right - left < MIN_CROP_FRACTION) {
    if (left + MIN_CROP_FRACTION <= 1) right = left + MIN_CROP_FRACTION;
    else {
      left = 1 - MIN_CROP_FRACTION;
      right = 1;
    }
  }
  if (bottom - top < MIN_CROP_FRACTION) {
    if (top + MIN_CROP_FRACTION <= 1) bottom = top + MIN_CROP_FRACTION;
    else {
      top = 1 - MIN_CROP_FRACTION;
      bottom = 1;
    }
  }

  return { left, top, right, bottom };
}

export function getImageSourceFrame(item: ImageItem): {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
} {
  const crop = normalizeCrop(item.crop);
  const cropWidth = crop.right - crop.left;
  const cropHeight = crop.bottom - crop.top;
  const widthMm = item.widthMm / cropWidth;
  const heightMm = item.heightMm / cropHeight;

  return {
    xMm: item.xMm - crop.left * widthMm,
    yMm: item.yMm - crop.top * heightMm,
    widthMm,
    heightMm,
  };
}

export function applyCropToImageFrame(
  item: ImageItem,
  requestedCrop: ImageCrop,
): Pick<ImageItem, "crop" | "xMm" | "yMm" | "widthMm" | "heightMm"> {
  const source = getImageSourceFrame(item);
  const crop = normalizeCrop(requestedCrop);

  return {
    crop,
    xMm: source.xMm + crop.left * source.widthMm,
    yMm: source.yMm + crop.top * source.heightMm,
    widthMm: (crop.right - crop.left) * source.widthMm,
    heightMm: (crop.bottom - crop.top) * source.heightMm,
  };
}

export function migrateLegacyCropGeometry(item: ImageItem): ImageItem {
  const crop = normalizeCrop(item.crop);
  return {
    ...item,
    crop,
    xMm: item.xMm + crop.left * item.widthMm,
    yMm: item.yMm + crop.top * item.heightMm,
    widthMm: (crop.right - crop.left) * item.widthMm,
    heightMm: (crop.bottom - crop.top) * item.heightMm,
  };
}
