export type Theme = "light" | "dark";

export const ui = $state({
  showShortcuts: false,
  showUnsavedWarning: false,
  pendingAction: null as (() => void) | null,
  theme: "light" as Theme,
});

export function toggleTheme(): void {
  ui.theme = ui.theme === "light" ? "dark" : "light";
  applyTheme(ui.theme);
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("printcut-theme", theme);
  } catch {
    // localStorage unavailable
  }
}

export function initTheme(): void {
  let saved: Theme | null = null;
  try {
    saved = localStorage.getItem("printcut-theme") as Theme | null;
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
