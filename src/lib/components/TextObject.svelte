<script lang="ts">
  import type { TextItem } from "../types/document.ts";
  import { doc, resizeItem, beginUndo, endUndo } from "../stores/documentStore.svelte.ts";
  import { mmToPx, pxToMm } from "../utils/units.ts";
  import { MIN_SIZE_MM } from "../types/document.ts";
  import ResizeHandles from "./ResizeHandles.svelte";
  import { resizeFrameFromScreenDelta, type ResizeHandle } from "../utils/resizeGeometry.ts";

  let { item, zIndex }: { item: TextItem; zIndex: number } = $props();

  const selected = $derived(doc.selectedItemIds.includes(item.id));
  const primarySelected = $derived(doc.selectedItemId === item.id);
  const pxX = $derived(mmToPx(item.xMm, doc.zoom));
  const pxY = $derived(mmToPx(item.yMm, doc.zoom));
  const pxW = $derived(mmToPx(item.widthMm, doc.zoom));
  const pxH = $derived(mmToPx(item.heightMm, doc.zoom));
  const fontSizePx = $derived(mmToPx(item.fontSizeMm, doc.zoom));

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
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleResizeMove(e: PointerEvent) {
    if (!resizing) return;
    const next = resizeFrameFromScreenDelta(
      resizeStartDim,
      resizeHandle,
      pxToMm(e.clientX - resizeStartPx.x, doc.zoom),
      pxToMm(e.clientY - resizeStartPx.y, doc.zoom),
      {
        lockedAspectRatio: false,
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
  class="absolute cursor-move select-none"
  class:ring-2={selected}
  class:ring-primary={selected}
  class:ring-offset-1={selected}
  style="left: {pxX}px; top: {pxY}px; width: {pxW}px; height: {pxH}px; transform: rotate({item.rotationDeg}deg); transform-origin: center; z-index: {zIndex}; --item-x: {item.xMm}mm; --item-y: {item.yMm}mm; --item-w: {item.widthMm}mm; --item-h: {item.heightMm}mm; --font-size: {item.fontSizeMm}mm;"
  role="figure"
  aria-label={item.name}
>
  <div
    class="h-full overflow-hidden whitespace-pre-wrap break-words pointer-events-none"
    style="font-family: {item.fontFamily}; font-size: {fontSizePx}px; font-weight: {item.fontWeight}; text-align: {item.textAlign}; color: {item.color}; line-height: 1.2;"
  >{item.text}</div>

  {#if primarySelected}
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
