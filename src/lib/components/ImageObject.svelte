<script lang="ts">
  import type { ImageItem } from "../types/document.ts";
  import { doc, selectItem, resizeItem } from "../stores/documentStore.svelte.ts";
  import { mmToPx, pxToMm } from "../utils/units.ts";
  import { MIN_SIZE_MM } from "../types/document.ts";
  import ResizeHandles from "./ResizeHandles.svelte";
  import CropHandles from "./CropHandles.svelte";

  let { item }: { item: ImageItem } = $props();

  const selected = $derived(doc.selectedItemId === item.id);
  const cropMode = $derived(doc.cropModeItemId === item.id);

  const pxX = $derived(mmToPx(item.xMm, doc.zoom));
  const pxY = $derived(mmToPx(item.yMm, doc.zoom));
  const pxW = $derived(mmToPx(item.widthMm, doc.zoom));
  const pxH = $derived(mmToPx(item.heightMm, doc.zoom));

  const cropRect = $derived.by(() => {
    const c = item.crop;
    return {
      cropX: c.left * item.naturalWidthPx,
      cropY: c.top * item.naturalHeightPx,
      cropW: (c.right - c.left) * item.naturalWidthPx,
      cropH: (c.bottom - c.top) * item.naturalHeightPx,
    };
  });

  const hasCrop = $derived(
    item.crop.left !== 0 || item.crop.top !== 0 || item.crop.right !== 1 || item.crop.bottom !== 1,
  );

  const viewBox = $derived(
    hasCrop
      ? `${cropRect.cropX} ${cropRect.cropY} ${cropRect.cropW} ${cropRect.cropH}`
      : `0 0 ${item.naturalWidthPx} ${item.naturalHeightPx}`,
  );

  let resizing = $state(false);
  let resizeHandle = $state("");
  let resizeStartPx = $state({ x: 0, y: 0 });
  let resizeStartDim = $state({ x: 0, y: 0, w: 0, h: 0 });

  function handleResizeStart(e: PointerEvent, handle: string) {
    e.stopPropagation();
    e.preventDefault();
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
      const cropW = (item.crop.right - item.crop.left) * item.naturalWidthPx;
      const cropH = (item.crop.bottom - item.crop.top) * item.naturalHeightPx;
      const aspect = cropH > 0 ? cropW / cropH : 1;

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
  role="img"
  aria-label={item.name}
>
  <div
    class="absolute inset-0 overflow-hidden"
    class:ring-2={selected && !cropMode}
    class:ring-primary={selected && !cropMode}
    class:ring-offset-1={selected && !cropMode}
  >
    <svg
      width="100%"
      height="100%"
      {viewBox}
      preserveAspectRatio="none"
      class="block pointer-events-none"
    >
      <image
        href={item.src}
        x="0"
        y="0"
        width={item.naturalWidthPx}
        height={item.naturalHeightPx}
      />
    </svg>
  </div>

  {#if selected && !cropMode}
    <ResizeHandles
      {pxW}
      {pxH}
      onResizeStart={handleResizeStart}
      onResizeMove={handleResizeMove}
      onResizeEnd={handleResizeEnd}
      {resizing}
    />
  {/if}

  {#if cropMode}
    <CropHandles {item} {pxW} {pxH} />
  {/if}
</div>
