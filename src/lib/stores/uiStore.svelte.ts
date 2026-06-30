export type Theme = "light" | "dark";

export const ui = $state({
  showShortcuts: false,
  showUnsavedWarning: false,
  pendingAction: null as (() => void) | null,
  theme: "light" as Theme,
  contextMenu: null as { x: number; y: number; itemId: string } | null,
  notice: null as { message: string; type: "success" | "error" | "info" } | null,
});

let noticeTimer: ReturnType<typeof setTimeout> | undefined;

export function showNotice(message: string, type: "success" | "error" | "info" = "info"): void {
  ui.notice = { message, type };
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    ui.notice = null;
  }, 3500);
}

export function toggleTheme(): void {
  ui.theme = ui.theme === "light" ? "dark" : "light";
  applyTheme(ui.theme);
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("trimkit-theme", theme);
  } catch {
    // localStorage unavailable
  }
}

export function initTheme(): void {
  let saved: Theme | null = null;
  try {
    saved = localStorage.getItem("trimkit-theme") as Theme | null;
  } catch {
    // localStorage unavailable
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  ui.theme = saved ?? (prefersDark ? "dark" : "light");
  applyTheme(ui.theme);
}

export function showShortcuts(): void {
  ui.showShortcuts = true;
}

export function hideShortcuts(): void {
  ui.showShortcuts = false;
}

export function showContextMenu(x: number, y: number, itemId: string): void {
  ui.contextMenu = { x, y, itemId };
}

export function hideContextMenu(): void {
  ui.contextMenu = null;
}

export function confirmAction(action: () => void): void {
  ui.pendingAction = action;
  ui.showUnsavedWarning = true;
}

export function executePendingAction(): void {
  if (ui.pendingAction) {
    ui.pendingAction();
    ui.pendingAction = null;
  }
  ui.showUnsavedWarning = false;
}

export function cancelPendingAction(): void {
  ui.pendingAction = null;
  ui.showUnsavedWarning = false;
}
