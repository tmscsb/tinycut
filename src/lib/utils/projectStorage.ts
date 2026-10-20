import { LOCAL_STORAGE_KEY, type DocumentState, type ImageItem } from "../types/document.ts";
import { createProjectId, isProjectId } from "./ids.ts";
import { normalizeDocument } from "./documentState.ts";
import {
  getAsset,
  hasAsset,
  ingestEmbeddedImages,
  isAssetId,
  isImageMime,
  registerAsset,
  registerAssetWithId,
  type ImageMime,
} from "./assets.ts";

/**
 * Browser storage layout, inside the origin private file system (OPFS):
 *
 *   tinycut/projects/<layout id>/project.json   small JSON: page, items, metadata
 *   tinycut/assets/<sha256>                     raw image bytes, shared by every layout
 *
 * Images are stored once however many layouts, duplicates, or cut pieces use them.
 */

export type StoredProjectMeta = {
  id: string;
  name: string;
  updatedAt: number;
  pageName: string;
  itemCount: number;
  imageCount: number;
  /** Bytes of the distinct images this layout uses. */
  imageBytes: number;
};

export type StoredProject = {
  document: DocumentState;
  meta: StoredProjectMeta;
  missingImages: number;
};

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`Project not found: ${id}`);
    this.name = "ProjectNotFoundError";
  }
}

export type StorageEntry = { name: string; kind: "file" | "directory" };

/** Paths are relative to the app's storage folder and use "/" separators. */
export type StorageBackend = {
  readFile(path: string): Promise<File | null>;
  writeFile(path: string, data: Blob): Promise<void>;
  list(directory: string): Promise<StorageEntry[]>;
  /** Removes a file or a whole folder; a missing path is not an error. */
  remove(path: string): Promise<void>;
};

type AssetTable = Record<string, { mime: ImageMime; size: number }>;

const STORAGE_FORMAT = 2;
const ASSET_GRACE_MS = 24 * 60 * 60 * 1000;
const LEGACY_ASSET_NAME = /^[a-zA-Z0-9._-]+$/;
const LEGACY_MIME_BY_EXT: Record<string, ImageMime> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

let backend: StorageBackend = createOpfsBackend();

export function setProjectBackend(next: StorageBackend): void {
  backend = next;
}

const projectFile = (id: string) => `projects/${id}/project.json`;
const assetFile = (id: string) => `assets/${id}`;

export function createMemoryBackend(): StorageBackend {
  const files = new Map<string, File>();
  return {
    async readFile(path) {
      return files.get(path) ?? null;
    },
    async writeFile(path, data) {
      files.set(path, new File([data], path.slice(path.lastIndexOf("/") + 1), { type: data.type }));
    },
    async list(directory) {
      const prefix = `${directory}/`;
      const entries = new Map<string, StorageEntry["kind"]>();
      for (const path of files.keys()) {
        if (!path.startsWith(prefix)) continue;
        const rest = path.slice(prefix.length);
        const slash = rest.indexOf("/");
        if (slash === -1) entries.set(rest, "file");
        else entries.set(rest.slice(0, slash), "directory");
      }
      return [...entries].map(([name, kind]) => ({ name, kind }));
    },
    async remove(path) {
      for (const key of [...files.keys()]) {
        if (key === path || key.startsWith(`${path}/`)) files.delete(key);
      }
    },
  };
}

export function packProject(doc: DocumentState): { json: string; meta: StoredProjectMeta; assetIds: string[] } {
  const assets: AssetTable = {};
  for (const item of doc.items) {
    if (item.type !== "image" || assets[item.assetId]) continue;
    // A missing image keeps its entry so the layout still saves and cleanup still sees the reference.
    const asset = getAsset(item.assetId);
    assets[item.assetId] = asset ? { mime: asset.mime, size: asset.blob.size } : { mime: "image/png", size: 0 };
  }
  const meta: StoredProjectMeta = {
    id: doc.id,
    name: doc.name,
    updatedAt: Date.now(),
    pageName: doc.page.name,
    itemCount: doc.items.length,
    imageCount: doc.items.filter((item) => item.type === "image").length,
    imageBytes: Object.values(assets).reduce((total, asset) => total + asset.size, 0),
  };
  const json = JSON.stringify({
    storage: STORAGE_FORMAT,
    ...meta,
    assets,
    document: {
      version: 2,
      id: doc.id,
      name: doc.name,
      page: doc.page,
      items: doc.items,
      zoom: doc.zoom,
      unit: doc.unit,
      gridSizeMm: doc.gridSizeMm,
      showGrid: doc.showGrid,
      snapToGrid: doc.snapToGrid,
      showGuides: doc.showGuides,
    },
  });
  return { json, meta, assetIds: Object.keys(assets) };
}

export async function writeStoredProject(doc: DocumentState): Promise<StoredProjectMeta> {
  // Everything is read from `doc` before the first await: the caller may switch layouts meanwhile.
  const packed = packProject(doc);
  const id = packed.meta.id;
  assertProjectId(id);
  // Image files first, so a project.json on disk never points at bytes that are not there.
  await storeAssets(packed.assetIds);
  await backend.writeFile(projectFile(id), new Blob([packed.json], { type: "application/json" }));
  return packed.meta;
}

/**
 * Writes these in-memory images to browser storage. A file already there is
 * rewritten once it is older than `refreshAfterMs`, so cleanup in another tab,
 * which only deletes files older than its grace period, never races a save or a copy.
 */
export async function storeAssets(ids: Iterable<string>, refreshAfterMs = ASSET_GRACE_MS / 2): Promise<void> {
  for (const id of new Set(ids)) {
    const asset = getAsset(id);
    if (!asset) continue;
    const existing = await backend.readFile(assetFile(id));
    if (existing && existing.size === asset.blob.size && Date.now() - existing.lastModified < refreshAfterMs) continue;
    await backend.writeFile(assetFile(id), asset.blob);
  }
}

/** Loads images saved by any layout or tab into memory. Returns how many could not be found. */
export async function loadStoredAssets(wanted: Iterable<{ id: string; mime: ImageMime }>): Promise<number> {
  let missing = 0;
  for (const { id, mime } of wanted) {
    if (hasAsset(id)) continue;
    const file = isAssetId(id) ? await backend.readFile(assetFile(id)) : null;
    if (file) await registerAssetWithId(id, file, mime);
    else missing += 1;
  }
  return missing;
}

export async function listStoredProjects(): Promise<StoredProjectMeta[]> {
  const projects: StoredProjectMeta[] = [];
  for (const id of await listProjectIds()) {
    try {
      const file = await backend.readFile(projectFile(id));
      if (file) projects.push(readMeta(id, JSON.parse(await file.text())));
    } catch {
      // Skip unreadable folders so one bad save cannot hide the rest.
    }
  }
  return projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function readStoredProject(id: string): Promise<StoredProject> {
  assertProjectId(id);
  const file = await backend.readFile(projectFile(id));
  if (!file) throw new ProjectNotFoundError(id);
  const envelope = asObject(JSON.parse(await file.text()));
  const meta = readMeta(id, envelope);

  if (envelope.storage !== STORAGE_FORMAT) return upgradeLegacyProject(id, envelope, meta);

  const assets = asAssetTable(envelope.assets);
  await loadStoredAssets(Object.entries(assets).map(([assetId, asset]) => ({ id: assetId, mime: asset.mime })));
  const document = normalizeDocument({ ...asObject(envelope.document), id, name: meta.name });
  return { document, meta, missingImages: countMissingImages(document) };
}

export async function deleteStoredProject(id: string): Promise<void> {
  assertProjectId(id);
  await backend.remove(`projects/${id}`);
}

/**
 * Deletes image files no saved layout uses. `inUse` protects this tab's unsaved
 * images; the grace period protects other tabs' unsaved images and clipboards.
 */
export async function collectUnusedAssets(inUse: Set<string>, now = Date.now()): Promise<number> {
  const referenced = new Set(inUse);
  for (const id of await listProjectIds()) {
    const file = await backend.readFile(projectFile(id));
    if (!file) continue;
    // A layout we cannot read might still need its images, so keep everything.
    const envelope = asObject(JSON.parse(await file.text()));
    for (const assetId of Object.keys(asObjectOrEmpty(envelope.assets))) referenced.add(assetId);
  }
  let removed = 0;
  for (const entry of await backend.list("assets")) {
    if (entry.kind !== "file" || referenced.has(entry.name)) continue;
    const file = await backend.readFile(assetFile(entry.name));
    if (file && now - file.lastModified > ASSET_GRACE_MS) {
      await backend.remove(assetFile(entry.name));
      removed += 1;
    }
  }
  return removed;
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number; persisted: boolean } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    const persisted = await navigator.storage.persisted?.() ?? false;
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, persisted };
  } catch {
    return null;
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return await navigator.storage?.persist?.() ?? false;
  } catch {
    return false;
  }
}

export async function migrateLegacyLocalStorage(): Promise<StoredProjectMeta | null> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = normalizeDocument(await ingestEmbeddedImages(JSON.parse(raw)));
    parsed.id = createProjectId();
    parsed.name = parsed.name === "Untitled" ? "Recovered layout" : parsed.name;
    const meta = await writeStoredProject(parsed);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {
      // Keep going; the recovered copy is already in browser files.
    }
    return meta;
  } catch {
    return null;
  }
}

/** Format 1 kept a private images/ folder per layout. Move its images into shared storage. */
async function upgradeLegacyProject(
  id: string,
  envelope: Record<string, unknown>,
  meta: StoredProjectMeta,
): Promise<StoredProject> {
  const documentValue = asObject(envelope.document ?? envelope);
  const rawItems = Array.isArray(documentValue.items) ? documentValue.items : [];
  const items = [];
  for (const rawItem of rawItems) {
    const item = asObject(rawItem);
    if (item.type !== "image" || typeof item.asset !== "string") {
      items.push(item);
      continue;
    }
    if (!LEGACY_ASSET_NAME.test(item.asset)) throw new Error("Invalid image asset");
    const bytes = await backend.readFile(`projects/${id}/images/${item.asset}`);
    if (!bytes) throw new Error("Missing image file");
    const mime = isImageMime(item.assetMime) ? item.assetMime : legacyMime(item.asset);
    const asset = await registerAsset(bytes, mime);
    const { asset: _asset, assetMime: _mime, ...rest } = item;
    items.push({ ...rest, assetId: asset.id });
  }
  const ingested = await ingestEmbeddedImages({ ...documentValue, items });
  const document = normalizeDocument({ ...asObject(ingested), id, name: meta.name });
  const upgraded = await writeStoredProject(document);
  await backend.remove(`projects/${id}/images`);
  return { document, meta: { ...upgraded, updatedAt: meta.updatedAt }, missingImages: 0 };
}

async function listProjectIds(): Promise<string[]> {
  const entries = await backend.list("projects");
  return entries.filter((entry) => entry.kind === "directory" && isProjectId(entry.name)).map((entry) => entry.name);
}

function readMeta(id: string, value: unknown): StoredProjectMeta {
  const envelope = asObject(value);
  const documentValue = asObjectOrEmpty(envelope.document);
  const items = Array.isArray(documentValue.items) ? documentValue.items as { type?: unknown }[] : [];
  const assets = asObjectOrEmpty(envelope.assets) as Partial<AssetTable>;
  const page = asObjectOrEmpty(documentValue.page);
  const count = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
  return {
    id,
    name: typeof envelope.name === "string" && envelope.name.trim() ? envelope.name.trim().slice(0, 80) : "Untitled",
    updatedAt: count(envelope.updatedAt, 0),
    pageName: typeof page.name === "string" ? page.name.slice(0, 120) : "",
    itemCount: count(envelope.itemCount, items.length),
    imageCount: count(envelope.imageCount, items.filter((item) => item?.type === "image").length),
    imageBytes: count(
      envelope.imageBytes,
      Object.values(assets).reduce((total, asset) => total + count(asset?.size, 0), 0),
    ),
  };
}

function countMissingImages(doc: DocumentState): number {
  return doc.items.filter((item): item is ImageItem => item.type === "image" && !hasAsset(item.assetId)).length;
}

function asAssetTable(value: unknown): AssetTable {
  const table: AssetTable = {};
  for (const [id, raw] of Object.entries(asObjectOrEmpty(value))) {
    const entry = asObjectOrEmpty(raw);
    if (!isAssetId(id) || !isImageMime(entry.mime)) continue;
    table[id] = { mime: entry.mime, size: typeof entry.size === "number" ? entry.size : 0 };
  }
  return table;
}

function legacyMime(filename: string): ImageMime {
  const dot = filename.lastIndexOf(".");
  return LEGACY_MIME_BY_EXT[dot >= 0 ? filename.slice(dot).toLowerCase() : ""] ?? "image/png";
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid project file");
  return value as Record<string, unknown>;
}

function asObjectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function assertProjectId(id: string): void {
  if (!isProjectId(id)) throw new Error("Invalid layout id");
}

function createOpfsBackend(): StorageBackend {
  async function appDir(): Promise<FileSystemDirectoryHandle> {
    if (typeof navigator === "undefined" || !navigator.storage?.getDirectory) {
      throw new Error("This browser cannot store layouts locally.");
    }
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle("tinycut", { create: true });
  }

  function splitPath(path: string): string[] {
    const parts = path.split("/").filter(Boolean);
    if (!parts.length || parts.some((part) => part === "." || part === "..")) throw new Error("Invalid storage path");
    return parts;
  }

  async function directory(parts: string[], create: boolean): Promise<FileSystemDirectoryHandle> {
    let dir = await appDir();
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
    return dir;
  }

  return {
    async readFile(path) {
      const parts = splitPath(path);
      const name = parts.pop()!;
      try {
        const dir = await directory(parts, false);
        return await (await dir.getFileHandle(name)).getFile();
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    async writeFile(path, data) {
      const parts = splitPath(path);
      const name = parts.pop()!;
      const dir = await directory(parts, true);
      const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
      try {
        await writable.write(data);
        await writable.close();
      } catch (error) {
        await writable.abort().catch(() => {});
        throw error;
      }
    },
    async list(path) {
      try {
        const dir = await directory(splitPath(path), false);
        const entries: StorageEntry[] = [];
        for await (const [name, handle] of dir.entries()) entries.push({ name, kind: handle.kind });
        return entries;
      } catch (error) {
        if (isNotFound(error)) return [];
        throw error;
      }
    },
    async remove(path) {
      const parts = splitPath(path);
      const name = parts.pop()!;
      try {
        const dir = await directory(parts, false);
        await dir.removeEntry(name, { recursive: true });
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    },
  };
}

function isNotFound(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotFoundError";
}
