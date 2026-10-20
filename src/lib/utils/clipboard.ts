import type { DocumentItem } from "../types/document.ts";
import { isAssetId, isImageMime, type ImageMime } from "./assets.ts";

/**
 * What Ctrl+C puts on the clipboard. Image bytes stay in browser storage and
 * are referenced by id, so copying a photo between tabs moves a few hundred bytes.
 */
export type ClipboardPayload = {
  format: "tinycut-items";
  version: 1;
  items: DocumentItem[];
  assets: { id: string; mime: ImageMime }[];
};

export const CLIPBOARD_MIME = "application/x-tinycut+json";

export function clipboardLabel(payload: ClipboardPayload): string {
  const count = payload.items.length;
  return `TinyCut: ${count} item${count === 1 ? "" : "s"}`;
}

/** Shape check only; the items still go through normalizeDocument before use. */
export function parseClipboardPayload(text: string): ClipboardPayload | null {
  try {
    const value = JSON.parse(text) as Partial<ClipboardPayload>;
    if (value?.format !== "tinycut-items" || value.version !== 1) return null;
    if (!Array.isArray(value.items) || !Array.isArray(value.assets)) return null;
    const assets = value.assets.filter((asset) => isAssetId(asset?.id) && isImageMime(asset?.mime));
    return { format: "tinycut-items", version: 1, items: value.items, assets };
  } catch {
    return null;
  }
}
