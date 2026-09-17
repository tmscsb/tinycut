export function createId(prefix = "item"): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}_${Date.now().toString(36)}`;
}

export function createProjectId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Math.random().toString(36).slice(2, 11)}${Date.now().toString(36)}`;
}

export function isProjectId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{7,79}$/i.test(value);
}
