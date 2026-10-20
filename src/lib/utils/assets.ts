/**
 * Image bytes live here, once per distinct file, keyed by their SHA-256.
 * Document items only hold the id, so undo snapshots, duplicates, cuts, and
 * saved layouts never copy the picture itself.
 */

export type ImageMime = "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";

export type ImageAsset = {
  id: string;
  mime: ImageMime;
  blob: Blob;
  url: string;
};

const IMAGE_MIMES = new Set<string>(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const ASSET_ID = /^[0-9a-f]{64}$/;
const IMAGE_DATA_URL = /^data:(image\/(?:png|jpeg|webp|svg\+xml))(;charset=[^;,]+)?(;base64)?,([\s\S]*)$/i;

const assets = new Map<string, ImageAsset>();
let onRegistered: () => void = () => {};

/** Lets the UI re-render items whose image arrives after they do. */
export function onAssetRegistered(callback: () => void): void {
  onRegistered = callback;
}

export function isImageMime(value: unknown): value is ImageMime {
  return typeof value === "string" && IMAGE_MIMES.has(value);
}

export function isAssetId(value: unknown): value is string {
  return typeof value === "string" && ASSET_ID.test(value);
}

async function hashBytes(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashBlob(blob: Blob): Promise<string> {
  return hashBytes(await blob.arrayBuffer());
}

// A File from disk or browser storage is read lazily and stops working when the
// file underneath changes or is deleted, so every asset keeps its own copy.

export async function registerAsset(blob: Blob, mime: ImageMime): Promise<ImageAsset> {
  const bytes = await blob.arrayBuffer();
  return remember(await hashBytes(bytes), bytes, mime);
}

/** For bytes read back from storage, whose id is already their hash. */
export async function registerAssetWithId(id: string, blob: Blob, mime: ImageMime): Promise<ImageAsset> {
  return assets.get(id) ?? remember(id, await blob.arrayBuffer(), mime);
}

function remember(id: string, bytes: ArrayBuffer, mime: ImageMime): ImageAsset {
  const existing = assets.get(id);
  if (existing) return existing;
  const blob = new Blob([bytes], { type: mime });
  const asset: ImageAsset = { id, mime, blob, url: URL.createObjectURL(blob) };
  assets.set(id, asset);
  onRegistered();
  return asset;
}

export function getAsset(id: string): ImageAsset | undefined {
  return assets.get(id);
}

export function hasAsset(id: string): boolean {
  return assets.has(id);
}

export function assetUrl(id: string): string {
  return assets.get(id)?.url ?? "";
}

export function loadedAssetIds(): Set<string> {
  return new Set(assets.keys());
}

export async function assetDataUrl(id: string): Promise<string> {
  const asset = assets.get(id);
  if (!asset) return "";
  return bytesToDataUrl(asset.mime, new Uint8Array(await asset.blob.arrayBuffer()));
}

export function parseImageDataUrl(src: string): { mime: ImageMime; bytes: Uint8Array } | null {
  const match = IMAGE_DATA_URL.exec(src);
  if (!match) return null;
  const mime = match[1].toLowerCase() as ImageMime;
  const payload = match[4];
  if (match[3]) {
    try {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return { mime, bytes };
    } catch {
      return null;
    }
  }
  try {
    return { mime, bytes: new TextEncoder().encode(decodeURIComponent(payload)) };
  } catch {
    return null;
  }
}

export function bytesToDataUrl(mime: string, bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/**
 * Older saves and backup files embed images as data URLs in `src`. Replace each
 * with an asset id so the rest of the app only ever sees `assetId`.
 */
export async function ingestEmbeddedImages(rawDocument: unknown): Promise<unknown> {
  if (!rawDocument || typeof rawDocument !== "object" || Array.isArray(rawDocument)) return rawDocument;
  const documentValue = rawDocument as Record<string, unknown>;
  if (!Array.isArray(documentValue.items)) return rawDocument;
  const items = await Promise.all(documentValue.items.map(async (rawItem) => {
    if (!rawItem || typeof rawItem !== "object") return rawItem;
    const item = rawItem as Record<string, unknown>;
    if (item.type !== "image" || typeof item.src !== "string") return item;
    const parsed = parseImageDataUrl(item.src);
    if (!parsed) throw new Error("Invalid image source");
    const asset = await registerAsset(new Blob([parsed.bytes as BlobPart], { type: parsed.mime }), parsed.mime);
    const { src: _src, ...rest } = item;
    return { ...rest, assetId: asset.id };
  }));
  return { ...documentValue, items };
}

/**
 * The inverse of ingestEmbeddedImages, for single-file backups that open anywhere.
 * Items whose image is missing are left out so the rest can still be backed up.
 */
export async function embedImages<T extends { items: unknown[] }>(documentValue: T): Promise<T> {
  const dataUrls = new Map<string, string>();
  const items = [];
  for (const rawItem of documentValue.items) {
    const item = rawItem as Record<string, unknown>;
    if (item.type !== "image" || !isAssetId(item.assetId)) {
      items.push(rawItem);
      continue;
    }
    let src = dataUrls.get(item.assetId);
    if (src === undefined) {
      src = await assetDataUrl(item.assetId);
      dataUrls.set(item.assetId, src);
    }
    if (!src) continue;
    const { assetId: _assetId, ...rest } = item;
    items.push({ ...rest, src });
  }
  return { ...documentValue, items };
}
