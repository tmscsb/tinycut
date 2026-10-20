/**
 * Every layout autosaves, so two tabs editing the same one would overwrite each
 * other. A tab holds a Web Lock named after its layout for as long as it shows it.
 */

const PREFIX = "tinycut-layout:";

let held: { id: string; release: () => void } | null = null;

function locks(): LockManager | null {
  return typeof navigator !== "undefined" && navigator.locks ? navigator.locks : null;
}

/** Switches this tab's lock to `id`. Resolves false if another tab already has that layout open. */
export async function claimLayout(id: string): Promise<boolean> {
  if (held?.id === id) return true;
  const manager = locks();
  if (!manager) {
    held = { id, release: () => {} };
    return true;
  }
  const acquired = await new Promise<(() => void) | null>((resolve) => {
    void manager.request(`${PREFIX}${id}`, { ifAvailable: true }, (lock) => {
      if (!lock) {
        resolve(null);
        return;
      }
      return new Promise<void>((release) => resolve(release));
    });
  });
  if (!acquired) return false;
  held?.release();
  held = { id, release: acquired };
  return true;
}

/** Layout ids other tabs currently have open. */
export async function layoutsOpenElsewhere(): Promise<Set<string>> {
  const manager = locks();
  if (!manager?.query) return new Set();
  try {
    const snapshot = await manager.query();
    return new Set(
      (snapshot.held ?? [])
        .map((lock) => lock.name ?? "")
        .filter((name) => name.startsWith(PREFIX))
        .map((name) => name.slice(PREFIX.length))
        .filter((id) => id !== held?.id),
    );
  } catch {
    return new Set();
  }
}
