import { LOCAL_STORAGE_KEY, type DocumentState } from "../types/document.ts";
import { createProjectId, isProjectId } from "./ids.ts";
import { normalizeDocument } from "./documentState.ts";

export type StoredProjectMeta = {
  id: string;
  name: string;
  updatedAt: number;
};

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`Project not found: ${id}`);
    this.name = "ProjectNotFoundError";
  }
}

export type ProjectBackend = {
  listProjectIds(): Promise<string[]>;
  readBytes(projectId: string, relativePath: string): Promise<Uint8Array | null>;
  writeBytes(projectId: string, relativePath: string, bytes: Uint8Array): Promise<void>;
  listFiles(projectId: string, directory: string): Promise<string[]>;
  removeFile(projectId: string, relativePath: string): Promise<void>;
  removeProject(projectId: string): Promise<void>;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const IMAGE_DATA_URL = /^data:(image\/(?:png|jpeg|webp|svg\+xml))(;charset=[^;,]+)?(;base64)?,([\s\S]*)$/i;
const ASSET_NAME = /^[a-zA-Z0-9._-]+$/;
const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};
const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

let backend: ProjectBackend = createOpfsBackend();

export function setProjectBackend(next: ProjectBackend): void {
  backend = next;
}

export function createMemoryBackend(): ProjectBackend {
  const files = new Map<string, Uint8Array>();
  const key = (projectId: string, relativePath: string) => `${projectId}/${relativePath}`;
  return {
    async listProjectIds() {
      const ids = new Set<string>();
      for (const path of files.keys()) {
        const id = path.slice(0, path.indexOf("/"));
        if (isProjectId(id)) ids.add(id);
      }
      return [...ids];
    },
    async readBytes(projectId, relativePath) {
      return files.get(key(projectId, relativePath)) ?? null;
    },
    async writeBytes(projectId, relativePath, bytes) {
      files.set(key(projectId, relativePath), bytes);
    },
    async listFiles(projectId, directory) {
      const prefix = `${projectId}/${directory}/`;
      return [...files.keys()]
        .filter((path) => path.startsWith(prefix))
        .map((path) => path.slice(prefix.length))
        .filter((name) => name.length > 0 && !name.includes("/"));
    },
    async removeFile(projectId, relativePath) {
      files.delete(key(projectId, relativePath));
    },
    async removeProject(projectId) {
      const prefix = `${projectId}/`;
      for (const path of [...files.keys()]) {
        if (path.startsWith(prefix)) files.delete(path);
      }
    },
  };
}

export function parseImageDataUrl(src: string): { mime: string; bytes: Uint8Array } | null {
  const match = IMAGE_DATA_URL.exec(src);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const payload = match[4];
  if (match[3]) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { mime, bytes };
  }
  try {
    return { mime, bytes: textEncoder.encode(decodeURIComponent(payload)) };
  } catch {
    return null;
  }
}

export function bytesToDataUrl(mime: string, bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

type PackedAsset = { filename: string; bytes: Uint8Array };

export function packProject(doc: DocumentState): { json: string; assets: PackedAsset[]; meta: StoredProjectMeta } {
  const usedNames = new Set<string>();
  const assets: PackedAsset[] = [];
  const items = doc.items.map((item) => {
    if (item.type !== "image") return item;
    const parsed = parseImageDataUrl(item.src);
    if (!parsed) return item;
    const filename = uniqueAssetName(item.id, parsed.mime, usedNames);
    assets.push({ filename, bytes: parsed.bytes });
    const { src: _src, ...rest } = item;
    return { ...rest, asset: filename, assetMime: parsed.mime };
  });
  const meta: StoredProjectMeta = {
    id: doc.id,
    name: doc.name,
    updatedAt: Date.now(),
  };
  const json = JSON.stringify({
    storage: 1,
    ...meta,
    document: {
      version: 2,
      id: doc.id,
      name: doc.name,
      page: doc.page,
      items,
      zoom: doc.zoom,
      unit: doc.unit,
      gridSizeMm: doc.gridSizeMm,
      showGrid: doc.showGrid,
      snapToGrid: doc.snapToGrid,
      showGuides: doc.showGuides,
    },
  });
  return { json, assets, meta };
}

export function unpackProject(json: string, readAsset: (filename: string) => Uint8Array | null): DocumentState {
  const envelope = JSON.parse(json) as {
    storage?: unknown;
    document?: unknown;
    id?: unknown;
    name?: unknown;
  };
  const rawDocument = envelope.document ?? envelope;
  const documentValue = asObject(rawDocument);
  const items = Array.isArray(documentValue.items) ? documentValue.items : [];
  documentValue.items = items.map((rawItem) => {
    const item = asObject(rawItem);
    if (item.type !== "image") return item;
    if (typeof item.src === "string" && item.src.startsWith("data:image/")) return item;
    const filename = typeof item.asset === "string" ? item.asset : "";
    if (!ASSET_NAME.test(filename)) throw new Error("Invalid image asset");
    const bytes = readAsset(filename);
    if (!bytes) throw new Error("Missing image file");
    const mime = typeof item.assetMime === "string" && item.assetMime in EXT_BY_MIME
      ? item.assetMime
      : mimeFromFilename(filename);
    const { asset: _asset, assetMime: _mime, ...rest } = item;
    return { ...rest, src: bytesToDataUrl(mime, bytes) };
  });
  if (typeof envelope.id === "string") documentValue.id = envelope.id;
  if (typeof envelope.name === "string") documentValue.name = envelope.name;
  return normalizeDocument(documentValue);
}

export async function listStoredProjects(): Promise<StoredProjectMeta[]> {
  const ids = await backend.listProjectIds();
  const projects: StoredProjectMeta[] = [];
  for (const id of ids) {
    try {
      projects.push(await readStoredMeta(id));
    } catch {
      // Skip unreadable folders so one bad save cannot hide the rest.
    }
  }
  return projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function readStoredProject(id: string): Promise<DocumentState> {
  assertProjectId(id);
  const bytes = await backend.readBytes(id, "project.json");
  if (!bytes) throw new ProjectNotFoundError(id);
  const assets = new Map<string, Uint8Array>();
  for (const filename of await backend.listFiles(id, "images")) {
    const data = await backend.readBytes(id, `images/${filename}`);
    if (data) assets.set(filename, data);
  }
  const parsed = unpackProject(textDecoder.decode(bytes), (filename) => assets.get(filename) ?? null);
  parsed.id = id;
  return parsed;
}

export async function writeStoredProject(doc: DocumentState): Promise<StoredProjectMeta> {
  assertProjectId(doc.id);
  const packed = packProject(doc);
  const used = new Set(packed.assets.map((asset) => asset.filename));
  for (const asset of packed.assets) {
    await backend.writeBytes(doc.id, `images/${asset.filename}`, asset.bytes);
  }
  await backend.writeBytes(doc.id, "project.json", textEncoder.encode(packed.json));
  for (const filename of await backend.listFiles(doc.id, "images")) {
    if (!used.has(filename)) await backend.removeFile(doc.id, `images/${filename}`);
  }
  return packed.meta;
}

export async function deleteStoredProject(id: string): Promise<void> {
  assertProjectId(id);
  await backend.removeProject(id);
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
    const parsed = normalizeDocument(JSON.parse(raw));
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

async function readStoredMeta(id: string): Promise<StoredProjectMeta> {
  const bytes = await backend.readBytes(id, "project.json");
  if (!bytes) throw new ProjectNotFoundError(id);
  const envelope = JSON.parse(textDecoder.decode(bytes)) as {
    id?: unknown;
    name?: unknown;
    updatedAt?: unknown;
  };
  return {
    id,
    name: typeof envelope.name === "string" && envelope.name.trim() ? envelope.name.trim().slice(0, 80) : "Untitled",
    updatedAt: typeof envelope.updatedAt === "number" && Number.isFinite(envelope.updatedAt)
      ? envelope.updatedAt
      : 0,
  };
}

function uniqueAssetName(itemId: string, mime: string, used: Set<string>): string {
  const ext = EXT_BY_MIME[mime] ?? ".bin";
  const base = `${itemId.replace(/[^a-zA-Z0-9_-]/g, "_") || "image"}${ext}`;
  let filename = base;
  let suffix = 2;
  while (used.has(filename)) {
    filename = `${base.slice(0, -ext.length)}-${suffix}${ext}`;
    suffix += 1;
  }
  used.add(filename);
  return filename;
}

function mimeFromFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : "";
  return MIME_BY_EXT[ext] ?? "image/png";
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid project file");
  return value as Record<string, unknown>;
}

function assertProjectId(id: string): void {
  if (!isProjectId(id)) throw new Error("Invalid layout id");
}

function createOpfsBackend(): ProjectBackend {
  async function rootDir(): Promise<FileSystemDirectoryHandle> {
    if (!navigator.storage?.getDirectory) {
      throw new Error("This browser cannot store layouts locally.");
    }
    const root = await navigator.storage.getDirectory();
    const tinycut = await root.getDirectoryHandle("tinycut", { create: true });
    return tinycut.getDirectoryHandle("projects", { create: true });
  }

  async function projectDir(projectId: string, create: boolean): Promise<FileSystemDirectoryHandle> {
    const projects = await rootDir();
    return projects.getDirectoryHandle(projectId, { create });
  }

  async function walk(
    projectId: string,
    relativePath: string,
    create: boolean,
  ): Promise<{ dir: FileSystemDirectoryHandle; fileName: string }> {
    const parts = relativePath.split("/").filter(Boolean);
    const fileName = parts.pop();
    if (!fileName || parts.some((part) => part === "." || part === "..")) throw new Error("Invalid storage path");
    let dir = await projectDir(projectId, create);
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create });
    }
    return { dir, fileName };
  }

  return {
    async listProjectIds() {
      const projects = await rootDir();
      const ids: string[] = [];
      for await (const [name, handle] of projects.entries()) {
        if (handle.kind === "directory" && isProjectId(name)) ids.push(name);
      }
      return ids;
    },
    async readBytes(projectId, relativePath) {
      try {
        const { dir, fileName } = await walk(projectId, relativePath, false);
        const file = await (await dir.getFileHandle(fileName)).getFile();
        return new Uint8Array(await file.arrayBuffer());
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    async writeBytes(projectId, relativePath, bytes) {
      const { dir, fileName } = await walk(projectId, relativePath, true);
      const handle = await dir.getFileHandle(fileName, { create: true });
      const writable = await handle.createWritable();
      const chunk = new Uint8Array(bytes.byteLength);
      chunk.set(bytes);
      await writable.write(chunk);
      await writable.close();
    },
    async listFiles(projectId, directory) {
      try {
        const dir = await (await projectDir(projectId, false)).getDirectoryHandle(directory);
        const names: string[] = [];
        for await (const [name, handle] of dir.entries()) {
          if (handle.kind === "file") names.push(name);
        }
        return names;
      } catch (error) {
        if (isNotFound(error)) return [];
        throw error;
      }
    },
    async removeFile(projectId, relativePath) {
      try {
        const { dir, fileName } = await walk(projectId, relativePath, false);
        await dir.removeEntry(fileName);
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    },
    async removeProject(projectId) {
      try {
        const projects = await rootDir();
        await projects.removeEntry(projectId, { recursive: true });
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    },
  };
}

function isNotFound(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotFoundError";
}
