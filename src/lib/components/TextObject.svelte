<script lang="ts">
  import type { TextItem } from "../types/document.ts";
  import { doc, resizeItem, beginUndo, snapValue } from "../stores/documentStore.svelte.ts";
  import { mmToPx, pxToMm } from "../utils/units.ts";
  import { MIN_SIZE_MM } from "../types/document.ts";
  import ResizeHandles from "./ResizeHandles.svelte";

  let { item, zIndex }: { item: TextItem; zIndex: number } = $props();

  const selected = $derived(doc.selectedItemIds.includes(item.id));
  const primarySelected = $derived(doc.selectedItemId === item.id);
  const pxX = $derived(mmToPx(item.xMm, doc.zoom));
  const pxY = $derived(mmToPx(item.yMm, doc.zoom));
  const pxW = $derived(mmToPx(item.widthMm, doc.zoom));
  const pxH = $derived(mmToPx(item.heightMm, doc.zoom));
  const fontSizePx = $derived(mmToPx(item.fontSizeMm, doc.zoom));

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
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleResizeMove(e: PointerEvent) {
    if (!resizing) return;
    const dx = pxToMm(e.clientX - resizeStartPx.x, doc.zoom);
    const dy = pxToMm(e.clientY - resizeStartPx.y, doc.zoom);
    const { x, y, w, h } = resizeStartDim;
    let width = resizeHandle.includes("e") ? w + dx : resizeHandle.includes("w") ? w - dx : w;
    let height = resizeHandle.includes("s") ? h + dy : resizeHandle.includes("n") ? h - dy : h;
    width = Math.max(MIN_SIZE_MM, snapValue(width));
    height = Math.max(MIN_SIZE_MM, snapValue(height));
    const nextX = resizeHandle.includes("w") ? x + w - width : x;
    const nextY = resizeHandle.includes("n") ? y + h - height : y;
    resizeItem(item.id, nextX, nextY, width, height);
  }

  function handleResizeEnd() {
    resizing = false;
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
