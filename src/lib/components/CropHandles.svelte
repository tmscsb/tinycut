<script lang="ts">
  import type { ImageItem, ImageCrop } from "../types/document.ts";
  import { cropSession, getSessionLocalCrop, updateSessionLocalCrop, beginUndo, endUndo } from "../stores/documentStore.svelte.ts";
  import { screenDeltaToLocalCropPercent } from "../utils/cropGeometry.ts";

  let { item, pxW, pxH }: {
    item: ImageItem;
    pxW: number;
    pxH: number;
  } = $props();

  let dragging = $state(false);
  let handleId = $state<string>("");
  let dragStartPx = $state({ x: 0, y: 0 });
  let dragStartCrop = $state({ left: 0, top: 0, right: 1, bottom: 1 });

  function startDrag(e: PointerEvent, handle: string) {
    e.stopPropagation();
    e.preventDefault();
    if (cropSession.mode !== "cut") beginUndo();
    dragging = true;
    handleId = handle;
    dragStartPx = { x: e.clientX, y: e.clientY };
    dragStartCrop = { ...localCrop };

    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
  }

  function onMove(e: PointerEvent) {
    if (!dragging) return;

    const dxPx = e.clientX - dragStartPx.x;
    const dyPx = e.clientY - dragStartPx.y;
    const { dxPercent, dyPercent } = screenDeltaToLocalCropPercent(dxPx, dyPx, item.rotationDeg, pxW, pxH);

    const crop: ImageCrop = { ...dragStartCrop };

    if (handleId === "move") {
      const regionW = dragStartCrop.right - dragStartCrop.left;
      const regionH = dragStartCrop.bottom - dragStartCrop.top;
      const newLeft = Math.max(0, Math.min(1 - regionW, dragStartCrop.left + dxPercent));
      const newTop = Math.max(0, Math.min(1 - regionH, dragStartCrop.top + dyPercent));
      crop.left = newLeft;
      crop.right = newLeft + regionW;
      crop.top = newTop;
      crop.bottom = newTop + regionH;
    } else {
      if (handleId.includes("l")) {
        crop.left = Math.max(0, Math.min(dragStartCrop.right - 0.01, dragStartCrop.left + dxPercent));
      }
      if (handleId.includes("r")) {
        crop.right = Math.min(1, Math.max(dragStartCrop.left + 0.01, dragStartCrop.right + dxPercent));
      }
      if (handleId.includes("t")) {
        crop.top = Math.max(0, Math.min(dragStartCrop.bottom - 0.01, dragStartCrop.top + dyPercent));
      }
      if (handleId.includes("b")) {
        crop.bottom = Math.min(1, Math.max(dragStartCrop.top + 0.01, dragStartCrop.bottom + dyPercent));
      }
    }

    updateSessionLocalCrop(item.id, crop);
  }

  function endDrag(e: PointerEvent) {
    dragging = false;
    handleId = "";
    endUndo();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
  }

  const localCrop = $derived(getSessionLocalCrop(item));
  const cropLeftPct = $derived(localCrop.left * 100);
  const cropTopPct = $derived(localCrop.top * 100);
  const cropWidthPct = $derived((localCrop.right - localCrop.left) * 100);
  const cropHeightPct = $derived((localCrop.bottom - localCrop.top) * 100);
  const isCut = $derived(cropSession.mode === "cut");
  const handleTone = $derived(isCut ? "bg-accent" : "bg-warning");
</script>

<!-- Dark overlay outside crop region -->
<div class="no-print absolute inset-0 pointer-events-none z-10">
  <div class="absolute bg-black/40" style="left: 0; top: 0; width: {cropLeftPct}%; height: 100%;"></div>
  <div class="absolute bg-black/40" style="right: 0; top: 0; width: {100 - localCrop.right * 100}%; height: 100%;"></div>
  <div class="absolute bg-black/40" style="left: {cropLeftPct}%; top: 0; width: {cropWidthPct}%; height: {cropTopPct}%;"></div>
  <div class="absolute bg-black/40" style="left: {cropLeftPct}%; bottom: 0; width: {cropWidthPct}%; height: {100 - localCrop.bottom * 100}%;"></div>
</div>

<!-- Crop/cut frame + handles -->
<div
  class="no-print absolute z-20 border-2 border-dashed cursor-move {isCut ? 'border-accent' : 'border-warning'}"
  data-region-handles={cropSession.mode}
  style="left: {cropLeftPct}%; top: {cropTopPct}%; width: {cropWidthPct}%; height: {cropHeightPct}%;"
  aria-hidden="true"
  onpointerdown={(e) => startDrag(e, "move")}
  onpointermove={onMove}
  onpointerup={endDrag}
  onpointercancel={endDrag}
>
  <!-- Edge handles -->
  <div
    class="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-8 {handleTone} cursor-ew-resize pointer-events-auto rounded-sm"
    aria-hidden="true"
    onpointerdown={(e) => startDrag(e, "l")}
    onpointermove={onMove}
    onpointerup={endDrag}
    onpointercancel={endDrag}
  ></div>
  <div
    class="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-1.5 h-8 {handleTone} cursor-ew-resize pointer-events-auto rounded-sm"
    aria-hidden="true"
    onpointerdown={(e) => startDrag(e, "r")}
    onpointermove={onMove}
    onpointerup={endDrag}
    onpointercancel={endDrag}
  ></div>
  <div
    class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-1.5 {handleTone} cursor-ns-resize pointer-events-auto rounded-sm"
    aria-hidden="true"
    onpointerdown={(e) => startDrag(e, "t")}
    onpointermove={onMove}
    onpointerup={endDrag}
    onpointercancel={endDrag}
  ></div>
  <div
    class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-8 h-1.5 {handleTone} cursor-ns-resize pointer-events-auto rounded-sm"
    aria-hidden="true"
    onpointerdown={(e) => startDrag(e, "b")}
    onpointermove={onMove}
    onpointerup={endDrag}
    onpointercancel={endDrag}
  ></div>

  <!-- Corner handles -->
  <div
    class="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-3 h-3 {handleTone} cursor-nw-resize pointer-events-auto rounded-sm border border-white/50"
    aria-hidden="true"
    onpointerdown={(e) => startDrag(e, "lt")}
    onpointermove={onMove}
    onpointerup={endDrag}
    onpointercancel={endDrag}
  ></div>
  <div
    class="absolute right-0 top-0 translate-x-1/2 -translate-y-1/2 w-3 h-3 {handleTone} cursor-ne-resize pointer-events-auto rounded-sm border border-white/50"
    aria-hidden="true"
    onpointerdown={(e) => startDrag(e, "rt")}
    onpointermove={onMove}
    onpointerup={endDrag}
    onpointercancel={endDrag}
  ></div>
  <div
    class="absolute left-0 bottom-0 -translate-x-1/2 translate-y-1/2 w-3 h-3 {handleTone} cursor-sw-resize pointer-events-auto rounded-sm border border-white/50"
    aria-hidden="true"
    onpointerdown={(e) => startDrag(e, "lb")}
    onpointermove={onMove}
    onpointerup={endDrag}
    onpointercancel={endDrag}
  ></div>
  <div
    class="absolute right-0 bottom-0 translate-x-1/2 translate-y-1/2 w-3 h-3 {handleTone} cursor-se-resize pointer-events-auto rounded-sm border border-white/50"
    aria-hidden="true"
    onpointerdown={(e) => startDrag(e, "rb")}
    onpointermove={onMove}
    onpointerup={endDrag}
    onpointercancel={endDrag}
  ></div>
</div>
