<script lang="ts">
  import type { ShapeItem } from "../types/document.ts";
  import { doc, resizeItem, beginUndo, endUndo } from "../stores/documentStore.svelte.ts";
  import { mmToPx, pxToMm } from "../utils/units.ts";
  import { MIN_SIZE_MM } from "../types/document.ts";
  import ResizeHandles from "./ResizeHandles.svelte";
  import RotationHandle from "./RotationHandle.svelte";
  import { resizeFrameFromScreenDelta, type ResizeHandle } from "../utils/resizeGeometry.ts";

  let { item, zIndex }: { item: ShapeItem; zIndex: number } = $props();

  const selected = $derived(doc.selectedItemIds.includes(item.id));
  const primarySelected = $derived(doc.selectedItemId === item.id);

  const pxX = $derived(mmToPx(item.xMm, doc.zoom));
  const pxY = $derived(mmToPx(item.yMm, doc.zoom));
  const pxW = $derived(mmToPx(item.widthMm, doc.zoom));
  const pxH = $derived(mmToPx(item.heightMm, doc.zoom));

  let resizing = $state(false);
  let resizeHandle = $state<ResizeHandle>("se");
  let resizeStartPx = $state({ x: 0, y: 0 });
  let resizeStartDim = $state({ xMm: 0, yMm: 0, widthMm: 0, heightMm: 0 });

  function handleResizeStart(e: PointerEvent, handle: ResizeHandle) {
    e.stopPropagation();
    e.preventDefault();
    beginUndo();
    resizing = true;
    resizeHandle = handle;
    resizeStartPx = { x: e.clientX, y: e.clientY };
    resizeStartDim = { xMm: item.xMm, yMm: item.yMm, widthMm: item.widthMm, heightMm: item.heightMm };

    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
  }

  function handleResizeMove(e: PointerEvent) {
    if (!resizing) return;

    const next = resizeFrameFromScreenDelta(
      resizeStartDim,
      resizeHandle,
      pxToMm(e.clientX - resizeStartPx.x, doc.zoom),
      pxToMm(e.clientY - resizeStartPx.y, doc.zoom),
      {
        lockedAspectRatio: item.lockedAspectRatio,
        minSizeMm: MIN_SIZE_MM,
        rotationDeg: item.rotationDeg,
        snapStepMm: doc.snapToGrid ? doc.gridSizeMm : undefined,
      },
    );
    resizeItem(item.id, next.xMm, next.yMm, next.widthMm, next.heightMm);
  }

  function handleResizeEnd(e: PointerEvent) {
    resizing = false;
    endUndo();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
  }
</script>

<div
  data-image-item={item.id}
  data-document-item
  style="position: absolute; left: {pxX}px; top: {pxY}px; width: {pxW}px; height: {pxH}px; transform: rotate({item.rotationDeg}deg); transform-origin: center; z-index: {zIndex}; --item-x: {item.xMm}mm; --item-y: {item.yMm}mm; --item-w: {item.widthMm}mm; --item-h: {item.heightMm}mm;"
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

  {#if primarySelected}
    <RotationHandle itemId={item.id} rotationDeg={item.rotationDeg} {pxW} />
    <ResizeHandles
      {pxW}
      {pxH}
      rotationDeg={item.rotationDeg}
      onResizeStart={handleResizeStart}
      onResizeMove={handleResizeMove}
      onResizeEnd={handleResizeEnd}
      {resizing}
    />
  {/if}
</div>
