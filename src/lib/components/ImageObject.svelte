<script lang="ts">
  import type { ImageItem } from "../types/document.ts";
  import { doc, resizeItem, beginUndo, endUndo } from "../stores/documentStore.svelte.ts";
  import { mmToPx, pxToMm } from "../utils/units.ts";
  import { MIN_SIZE_MM } from "../types/document.ts";
  import ResizeHandles from "./ResizeHandles.svelte";
  import CropHandles from "./CropHandles.svelte";
  import { getImageCropTransformOrigin, getImageSourceFrame } from "../utils/cropGeometry.ts";
  import { resizeFrameFromScreenDelta, type ResizeHandle } from "../utils/resizeGeometry.ts";

  let { item, zIndex }: { item: ImageItem; zIndex: number } = $props();

  const selected = $derived(doc.selectedItemIds.includes(item.id));
  const primarySelected = $derived(doc.selectedItemId === item.id);
  const cropMode = $derived(doc.cropModeItemId === item.id);

  const cropFracW = $derived(item.crop.right - item.crop.left);
  const cropFracH = $derived(item.crop.bottom - item.crop.top);
  const hasCrop = $derived(item.crop.left !== 0 || item.crop.top !== 0 || item.crop.right !== 1 || item.crop.bottom !== 1);

  const sourceFrame = $derived(getImageSourceFrame(item));
  const cropTransformOrigin = $derived(getImageCropTransformOrigin(item));
  const displayX = $derived(mmToPx(cropMode ? sourceFrame.xMm : item.xMm, doc.zoom));
  const displayY = $derived(mmToPx(cropMode ? sourceFrame.yMm : item.yMm, doc.zoom));
  const displayW = $derived(mmToPx(cropMode ? sourceFrame.widthMm : item.widthMm, doc.zoom));
  const displayH = $derived(mmToPx(cropMode ? sourceFrame.heightMm : item.heightMm, doc.zoom));
  const transformOriginX = $derived(cropMode ? mmToPx(cropTransformOrigin.xMm, doc.zoom) : displayW / 2);
  const transformOriginY = $derived(cropMode ? mmToPx(cropTransformOrigin.yMm, doc.zoom) : displayH / 2);

  const cropViewX = $derived(item.crop.left * item.naturalWidthPx);
  const cropViewY = $derived(item.crop.top * item.naturalHeightPx);
  const cropViewW = $derived(cropFracW * item.naturalWidthPx);
  const cropViewH = $derived(cropFracH * item.naturalHeightPx);

  const effectiveViewBox = $derived(
    cropMode
      ? `0 0 ${item.naturalWidthPx} ${item.naturalHeightPx}`
      : (hasCrop ? `${cropViewX} ${cropViewY} ${cropViewW} ${cropViewH}` : `0 0 ${item.naturalWidthPx} ${item.naturalHeightPx}`),
  );

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
  style="position: absolute; left: {displayX}px; top: {displayY}px; width: {displayW}px; height: {displayH}px; transform: rotate({item.rotationDeg}deg); transform-origin: {transformOriginX}px {transformOriginY}px; z-index: {zIndex}; --item-x: {item.xMm}mm; --item-y: {item.yMm}mm; --item-w: {item.widthMm}mm; --item-h: {item.heightMm}mm;"
  class="cursor-move select-none"
  role="img"
  aria-label={item.name}
>
  <div
    class="absolute inset-0 overflow-hidden"
  >
    <svg
      width="100%"
      height="100%"
      viewBox={effectiveViewBox}
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

    {#if selected && !cropMode}
      <div class="no-print absolute inset-0 border border-primary pointer-events-none"></div>
    {/if}
  </div>

  {#if primarySelected && !cropMode}
    <ResizeHandles
      pxW={displayW}
      pxH={displayH}
      onResizeStart={handleResizeStart}
      onResizeMove={handleResizeMove}
      onResizeEnd={handleResizeEnd}
      {resizing}
    />
  {/if}

  {#if cropMode}
    <CropHandles {item} pxW={displayW} pxH={displayH} />
  {/if}
</div>
