import { isProjectId } from "./ids.ts";

const HASH_PREFIX = "#/p/";

export function projectHash(id: string): string {
  return `${HASH_PREFIX}${id}`;
}

export function readProjectIdFromHash(hash: string): string | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  let id = hash.slice(HASH_PREFIX.length);
  const cut = id.search(/[/?#]/);
  if (cut >= 0) id = id.slice(0, cut);
  try {
    id = decodeURIComponent(id);
  } catch {
    return null;
  }
  return isProjectId(id) ? id : null;
}

export function readProjectIdFromLocation(): string | null {
  if (typeof location === "undefined") return null;
  return readProjectIdFromHash(location.hash);
}

export function writeProjectIdToLocation(id: string, mode: "replace" | "push" = "replace"): void {
  if (typeof location === "undefined" || typeof history === "undefined") return;
  const url = `${location.pathname}${location.search}${projectHash(id)}`;
  const current = `${location.pathname}${location.search}${location.hash}`;
  if (current === url) return;
  if (mode === "push") history.pushState({ tinycutProjectId: id }, "", url);
  else history.replaceState({ tinycutProjectId: id }, "", url);
}
