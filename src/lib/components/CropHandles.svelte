<script lang="ts">
  import type { ImageItem, ImageCrop } from "../types/document.ts";
  import { updateItem } from "../stores/documentStore.svelte.ts";

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
    dragging = true;
    handleId = handle;
    dragStartPx = { x: e.clientX, y: e.clientY };
    dragStartCrop = { ...item.crop };

    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
  }

  function onMove(e: PointerEvent) {
    if (!dragging) return;

    const dxPx = e.clientX - dragStartPx.x;
    const dyPx = e.clientY - dragStartPx.y;
    const dxPercent = dxPx / pxW;
    const dyPercent = dyPx / pxH;

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

    updateItem(item.id, { crop });
  }

  function endDrag(e: PointerEvent) {
    dragging = false;
    handleId = "";
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
  }

  const cropLeftPct = $derived(item.crop.left * 100);
  const cropTopPct = $derived(item.crop.top * 100);
  const cropWidthPct = $derived((item.crop.right - item.crop.left) * 100);
  const cropHeightPct = $derived((item.crop.bottom - item.crop.top) * 100);
</script>

<!-- Dark overlay outside crop region -->
<div class="absolute inset-0 pointer-events-none z-10">
  <div class="absolute bg-black/40" style="left: 0; top: 0; width: {cropLeftPct}%; height: 100%;"></div>
  <div class="absolute bg-black/40" style="right: 0; top: 0; width: {100 - item.crop.right * 100}%; height: 100%;"></div>
  <div class="absolute bg-black/40" style="left: {cropLeftPct}%; top: 0; width: {cropWidthPct}%; height: {cropTopPct}%;"></div>
  <div class="absolute bg-black/40" style="left: {cropLeftPct}%; bottom: 0; width: {cropWidthPct}%; height: {100 - item.crop.bottom * 100}%;"></div>
</div>

<!-- Crop frame + handles -->
<div
  class="absolute z-20 border-2 border-dashed border-warning cursor-move"
  style="left: {cropLeftPct}%; top: {cropTopPct}%; width: {cropWidthPct}%; height: {cropHeightPct}%;"
  role="button"
  tabindex="-1"
  aria-label="Move crop region"
  onpointerdown={(e) => startDrag(e, "move")}
  onpointermove={onMove}
  onpointerup={endDrag}
>
  <!-- Edge handles -->
  <div
    class="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-8 bg-warning cursor-ew-resize pointer-events-auto rounded-sm"
    role="button" tabindex="-1" aria-label="Crop left edge"
    onpointerdown={(e) => startDrag(e, "l")}
    onpointermove={onMove}
    onpointerup={endDrag}
  ></div>
  <div
    class="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-1.5 h-8 bg-warning cursor-ew-resize pointer-events-auto rounded-sm"
    role="button" tabindex="-1" aria-label="Crop right edge"
    onpointerdown={(e) => startDrag(e, "r")}
    onpointermove={onMove}
    onpointerup={endDrag}
  ></div>
  <div
    class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-1.5 bg-warning cursor-ns-resize pointer-events-auto rounded-sm"
    role="button" tabindex="-1" aria-label="Crop top edge"
    onpointerdown={(e) => startDrag(e, "t")}
    onpointermove={onMove}
    onpointerup={endDrag}
  ></div>
  <div
    class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-8 h-1.5 bg-warning cursor-ns-resize pointer-events-auto rounded-sm"
    role="button" tabindex="-1" aria-label="Crop bottom edge"
    onpointerdown={(e) => startDrag(e, "b")}
    onpointermove={onMove}
    onpointerup={endDrag}
  ></div>

  <!-- Corner handles -->
  <div
    class="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-warning cursor-nw-resize pointer-events-auto rounded-sm border border-white/50"
    role="button" tabindex="-1" aria-label="Crop top-left corner"
    onpointerdown={(e) => startDrag(e, "lt")}
    onpointermove={onMove}
    onpointerup={endDrag}
  ></div>
  <div
    class="absolute right-0 top-0 translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-warning cursor-ne-resize pointer-events-auto rounded-sm border border-white/50"
    role="button" tabindex="-1" aria-label="Crop top-right corner"
    onpointerdown={(e) => startDrag(e, "rt")}
    onpointermove={onMove}
    onpointerup={endDrag}
  ></div>
  <div
    class="absolute left-0 bottom-0 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-warning cursor-sw-resize pointer-events-auto rounded-sm border border-white/50"
    role="button" tabindex="-1" aria-label="Crop bottom-left corner"
    onpointerdown={(e) => startDrag(e, "lb")}
    onpointermove={onMove}
    onpointerup={endDrag}
  ></div>
  <div
    class="absolute right-0 bottom-0 translate-x-1/2 translate-y-1/2 w-3 h-3 bg-warning cursor-se-resize pointer-events-auto rounded-sm border border-white/50"
    role="button" tabindex="-1" aria-label="Crop bottom-right corner"
    onpointerdown={(e) => startDrag(e, "rb")}
    onpointermove={onMove}
    onpointerup={endDrag}
  ></div>
</div>
