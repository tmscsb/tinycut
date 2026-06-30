<script lang="ts">
  import type { ShapeItem } from "../types/document.ts";
  import { doc, selectItem, resizeItem, beginUndo } from "../stores/documentStore.svelte.ts";
  import { mmToPx, pxToMm } from "../utils/units.ts";
  import { MIN_SIZE_MM } from "../types/document.ts";
  import ResizeHandles from "./ResizeHandles.svelte";

  let { item }: { item: ShapeItem } = $props();

  const selected = $derived(doc.selectedItemId === item.id);

  const pxX = $derived(mmToPx(item.xMm, doc.zoom));
  const pxY = $derived(mmToPx(item.yMm, doc.zoom));
  const pxW = $derived(mmToPx(item.widthMm, doc.zoom));
  const pxH = $derived(mmToPx(item.heightMm, doc.zoom));

  let resizing = $state(false);
  let resizeHandle = $state("");
  let resizeStartPx = $state({ x: 0, y: 0 });
  let resizeStartDim = $state({ x: 0, y: 0, w: 0, h: 0 });

  function handleResizeStart(e: PointerEvent, handle: string) {
    e.stopPropagation();
    e.preventDefault();
    beginUndo();
    resizing = true;
    resizeHandle = handle;
    resizeStartPx = { x: e.clientX, y: e.clientY };
    resizeStartDim = { x: item.xMm, y: item.yMm, w: item.widthMm, h: item.heightMm };

    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
  }

  function handleResizeMove(e: PointerEvent) {
    if (!resizing) return;

    const dx = pxToMm(e.clientX - resizeStartPx.x, doc.zoom);
    const dy = pxToMm(e.clientY - resizeStartPx.y, doc.zoom);
    const handle = resizeHandle;
    const { x: sx, y: sy, w: sw, h: sh } = resizeStartDim;

    let newW = sw;
    let newH = sh;

    if (handle.includes("e")) newW = sw + dx;
    if (handle.includes("w")) newW = sw - dx;
    if (handle.includes("s")) newH = sh + dy;
    if (handle.includes("n")) newH = sh - dy;

    if (item.lockedAspectRatio) {
      const aspect = sw / sh || 1;
      const isHorizontal = handle === "e" || handle === "w";
      const isVertical = handle === "n" || handle === "s";

      if (isHorizontal) {
        newW = Math.max(MIN_SIZE_MM, newW);
        newH = newW / aspect;
      } else if (isVertical) {
        newH = Math.max(MIN_SIZE_MM, newH);
        newW = newH * aspect;
      } else {
        if (Math.abs(dx) >= Math.abs(dy)) {
          newW = Math.max(MIN_SIZE_MM, newW);
          newH = newW / aspect;
        } else {
          newH = Math.max(MIN_SIZE_MM, newH);
          newW = newH * aspect;
        }
      }
    } else {
      newW = Math.max(MIN_SIZE_MM, newW);
      newH = Math.max(MIN_SIZE_MM, newH);
    }

    let newX = sx;
    let newY = sy;
    if (handle.includes("w")) newX = sx + sw - newW;
    if (handle.includes("n")) newY = sy + sh - newH;

    resizeItem(item.id, newX, newY, newW, newH);
  }

  function handleResizeEnd(e: PointerEvent) {
    resizing = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
  }
</script>

<div
  data-image-item={item.id}
  style="position: absolute; left: {pxX}px; top: {pxY}px; width: {pxW}px; height: {pxH}px; z-index: {selected ? 10 : 1};"
  class="cursor-move select-none"
  role="figure"
  aria-label={item.name}
>
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 {item.widthMm} {item.heightMm}"
    class="block pointer-events-none"
    class:ring-2={selected}
    class:ring-primary={selected}
    class:ring-offset-1={selected}
  >
    {#if item.shapeType === "rect"}
      <rect
        x={item.strokeWidthMm / 2}
        y={item.strokeWidthMm / 2}
        width={item.widthMm - item.strokeWidthMm}
        height={item.heightMm - item.strokeWidthMm}
        rx={item.cornerRadiusMm}
        fill={item.fill}
        stroke={item.stroke}
        stroke-width={item.strokeWidthMm}
      />
    {:else if item.shapeType === "ellipse"}
      <ellipse
        cx={item.widthMm / 2}
        cy={item.heightMm / 2}
        rx={item.widthMm / 2 - item.strokeWidthMm / 2}
        ry={item.heightMm / 2 - item.strokeWidthMm / 2}
        fill={item.fill}
        stroke={item.stroke}
        stroke-width={item.strokeWidthMm}
      />
    {:else if item.shapeType === "line"}
      <line
        x1={item.strokeWidthMm / 2}
        y1={item.strokeWidthMm / 2}
        x2={item.widthMm - item.strokeWidthMm / 2}
        y2={item.heightMm - item.strokeWidthMm / 2}
        stroke={item.stroke}
        stroke-width={item.strokeWidthMm}
        stroke-linecap="round"
      />
    {/if}
  </svg>

  {#if selected}
    <ResizeHandles
      {pxW}
      {pxH}
      onResizeStart={handleResizeStart}
      onResizeMove={handleResizeMove}
      onResizeEnd={handleResizeEnd}
      {resizing}
    />
  {/if}
</div>
