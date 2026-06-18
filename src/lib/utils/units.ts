export const PX_PER_MM = 96 / 25.4;

export function mmToPx(mm: number, zoom = 1): number {
  return mm * PX_PER_MM * zoom;
}

export function pxToMm(px: number, zoom = 1): number {
  return px / PX_PER_MM / zoom;
}

export function cmToMm(cm: number): number {
  return cm * 10;
}

export function mmToCm(mm: number): number {
  return mm / 10;
}

import type { Unit } from "../types/document.ts";

export function displayValue(mm: number, unit: Unit): number {
  return unit === "cm" ? mm / 10 : mm;
}

export function parseInputToMm(value: number, unit: Unit): number {
  return unit === "cm" ? value * 10 : value;
}

export function formatDisplay(mm: number, unit: Unit): string {
  const v = displayValue(mm, unit);
  return unit === "cm" ? v.toFixed(2) : v.toFixed(1);
}
