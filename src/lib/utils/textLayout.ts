import type { TextItem } from "../types/document.ts";

/** Wrap by measured width, preserving paragraphs and breaking long words. */
export function wrapText(text: string, width: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n")) {
    let line = "";
    for (const token of paragraph.match(/\s+|\S+/gu) ?? []) {
      if (line && measure(line + token) > width) {
        lines.push(line.trimEnd());
        line = "";
        if (/^\s+$/u.test(token)) continue;
      }
      for (const character of token) {
        if (line && measure(line + character) > width) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

let context: CanvasRenderingContext2D | null | undefined;

/** Shared millimeter-based typography for the editor, SVG, PNG, and print. */
export function layoutText(item: TextItem) {
  if (context === undefined && typeof document !== "undefined") {
    context = document.createElement("canvas").getContext("2d");
  }
  // Measuring at a fixed large size avoids zoom-dependent rounding.
  if (context) context.font = `${item.fontWeight} 100px ${item.fontFamily}`;
  const scale = item.fontSizeMm / 100;
  const measure = (value: string) => context
    ? context.measureText(value).width * scale
    : Array.from(value).length * item.fontSizeMm * 0.55;
  const metrics = context?.measureText("Mg");
  const ascent = (metrics?.fontBoundingBoxAscent ?? 90) * scale;
  const descent = (metrics?.fontBoundingBoxDescent ?? 20) * scale;
  const lineHeight = item.fontSizeMm * 1.2;
  const baseline = ascent + (lineHeight - ascent - descent) / 2;
  const x = item.textAlign === "center" ? item.widthMm / 2 : item.textAlign === "right" ? item.widthMm : 0;
  return {
    lines: wrapText(item.text, item.widthMm, measure),
    x,
    baseline,
    lineHeight,
    anchor: item.textAlign === "center" ? "middle" : item.textAlign === "right" ? "end" : "start",
  };
}
