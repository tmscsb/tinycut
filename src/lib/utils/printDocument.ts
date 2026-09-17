import type { DocumentState } from "../types/document.ts";
import { exportDocumentAsSvg } from "./exportSvg.ts";

export const PRINT_SURFACE_CLASS = "tinycut-print-surface";
export const PRINT_PAGE_STYLE_ID = "trimkit-print-page-size";

export function stripXmlDeclaration(markup: string): string {
  return markup.replace(/^<\?xml[^?]*\?>\s*/u, "");
}

export function printSurfaceInnerHtml(state: DocumentState): string {
  return stripXmlDeclaration(exportDocumentAsSvg(state));
}

export function setPrintPageSize(widthMm: number, heightMm: number): void {
  let style = document.getElementById(PRINT_PAGE_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = PRINT_PAGE_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `@media print { @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; } }`;
}

export function preparePrintSurface(state: DocumentState): HTMLElement {
  removePrintSurface();
  setPrintPageSize(state.page.widthMm, state.page.heightMm);
  const surface = document.createElement("div");
  surface.className = PRINT_SURFACE_CLASS;
  surface.setAttribute("aria-hidden", "true");
  surface.style.setProperty("--print-page-w", `${state.page.widthMm}mm`);
  surface.style.setProperty("--print-page-h", `${state.page.heightMm}mm`);
  surface.innerHTML = printSurfaceInnerHtml(state);
  document.body.appendChild(surface);
  return surface;
}

export function removePrintSurface(): void {
  document.querySelectorAll(`.${PRINT_SURFACE_CLASS}`).forEach((element) => element.remove());
}
