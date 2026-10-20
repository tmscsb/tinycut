<script lang="ts">
  import type { ImageItem, ImageCrop } from "../types/document.ts";
  import { cropSession, getSessionLocalCrop, updateSessionLocalCrop, beginUndo, endUndo } from "../stores/documentStore.svelte.ts";
  import { regionFromPoints, screenDeltaToLocalCropPercent, screenPointToLocalFraction } from "../utils/cropGeometry.ts";

  let { item, pxW, pxH }: {
    item: ImageItem;
    pxW: number;
    pxH: number;
  } = $props();

  type Gesture =
    | { kind: "draw"; anchor: { x: number; y: number }; bounds: DOMRect; startPx: { x: number; y: number }; moved: boolean }
    | { kind: "handle"; handle: string; startPx: { x: number; y: number }; startCrop: ImageCrop };

  const DRAW_THRESHOLD_PX = 3;
  let gesture = $state<Gesture | null>(null);

  const localCrop = $derived(getSessionLocalCrop(item));
  const isCut = $derived(cropSession.mode === "cut");
  const handleTone = $derived(isCut ? "bg-accent" : "bg-warning");
  // A mark covering the whole image cannot move, so dragging inside it draws a new one.
  const coversImage = $derived(!!localCrop && localCrop.left <= 0 && localCrop.top <= 0 && localCrop.right >= 1 && localCrop.bottom >= 1);
  const corners = ["lt", "rt", "lb", "rb"] as const;
  const edges = ["l", "r", "t", "b"] as const;

  function capture(e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (!isCut) beginUndo();
  }

  function startDraw(e: PointerEvent) {
    if (e.button !== 0) return;
    capture(e);
    const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
    gesture = {
      kind: "draw",
      anchor: screenPointToLocalFraction(e.clientX, e.clientY, bounds, item.rotationDeg, pxW, pxH),
      bounds,
      startPx: { x: e.clientX, y: e.clientY },
      moved: false,
    };
  }

  function startHandle(e: PointerEvent, handle: string) {
    if (e.button !== 0 || !localCrop) return;
    capture(e);
    gesture = { kind: "handle", handle, startPx: { x: e.clientX, y: e.clientY }, startCrop: { ...localCrop } };
  }

  function onMove(e: PointerEvent) {
    if (!gesture) return;
    if (gesture.kind === "draw") {
      if (!gesture.moved && Math.hypot(e.clientX - gesture.startPx.x, e.clientY - gesture.startPx.y) < DRAW_THRESHOLD_PX) return;
      gesture.moved = true;
      const point = screenPointToLocalFraction(e.clientX, e.clientY, gesture.bounds, item.rotationDeg, pxW, pxH);
      updateSessionLocalCrop(item.id, regionFromPoints(gesture.anchor, point));
      return;
    }
    const { dxPercent, dyPercent } = screenDeltaToLocalCropPercent(
      e.clientX - gesture.startPx.x,
      e.clientY - gesture.startPx.y,
      item.rotationDeg,
      pxW,
      pxH,
    );
    updateSessionLocalCrop(item.id, movedRegion(gesture.startCrop, gesture.handle, dxPercent, dyPercent));
  }

  function movedRegion(start: ImageCrop, handle: string, dx: number, dy: number): ImageCrop {
    if (handle === "move") {
      const width = start.right - start.left;
      const height = start.bottom - start.top;
      const left = Math.max(0, Math.min(1 - width, start.left + dx));
      const top = Math.max(0, Math.min(1 - height, start.top + dy));
      return { left, top, right: left + width, bottom: top + height };
    }
    const crop = { ...start };
    if (handle.includes("l")) crop.left = Math.max(0, Math.min(start.right - 0.01, start.left + dx));
    if (handle.includes("r")) crop.right = Math.min(1, Math.max(start.left + 0.01, start.right + dx));
    if (handle.includes("t")) crop.top = Math.max(0, Math.min(start.bottom - 0.01, start.top + dy));
    if (handle.includes("b")) crop.bottom = Math.min(1, Math.max(start.top + 0.01, start.bottom + dy));
    return crop;
  }

  function endGesture(e: PointerEvent) {
    // A click outside the marked piece, without dragging, clears the mark.
    if (gesture?.kind === "draw" && !gesture.moved && isCut) updateSessionLocalCrop(item.id, null);
    gesture = null;
    endUndo();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
  }

  const handleClass: Record<string, string> = {
    l: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-8 cursor-ew-resize",
    r: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-1.5 h-8 cursor-ew-resize",
    t: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-1.5 cursor-ns-resize",
    b: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-8 h-1.5 cursor-ns-resize",
    lt: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-3 h-3 cursor-nw-resize border border-white/50",
    rt: "right-0 top-0 translate-x-1/2 -translate-y-1/2 w-3 h-3 cursor-ne-resize border border-white/50",
    lb: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 w-3 h-3 cursor-sw-resize border border-white/50",
    rb: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 w-3 h-3 cursor-se-resize border border-white/50",
  };
</script>

<!-- Drawing surface: drag anywhere on the image to mark a new region. -->
<div
  class="no-print absolute inset-0 z-10 cursor-crosshair"
  data-region-surface={cropSession.mode}
  aria-hidden="true"
  onpointerdown={startDraw}
  onpointermove={onMove}
  onpointerup={endGesture}
  onpointercancel={endGesture}
>
  {#if localCrop}
    <div class="absolute bg-black/40 pointer-events-none" style="left: 0; top: 0; width: {localCrop.left * 100}%; height: 100%;"></div>
    <div class="absolute bg-black/40 pointer-events-none" style="right: 0; top: 0; width: {100 - localCrop.right * 100}%; height: 100%;"></div>
    <div class="absolute bg-black/40 pointer-events-none" style="left: {localCrop.left * 100}%; top: 0; width: {(localCrop.right - localCrop.left) * 100}%; height: {localCrop.top * 100}%;"></div>
    <div class="absolute bg-black/40 pointer-events-none" style="left: {localCrop.left * 100}%; bottom: 0; width: {(localCrop.right - localCrop.left) * 100}%; height: {100 - localCrop.bottom * 100}%;"></div>
  {:else}
    <div class="absolute inset-0 bg-black/20 pointer-events-none flex items-center justify-center p-2">
      <span class="badge badge-accent badge-sm shadow text-center h-auto py-1">Drag to mark a piece</span>
    </div>
  {/if}
</div>

{#if localCrop}
  <!-- Marked region: drag inside to move it, or use the handles to resize. -->
  <div
    class="no-print absolute z-20 border-2 border-dashed {coversImage ? 'cursor-crosshair' : 'cursor-move'} {isCut ? 'border-accent' : 'border-warning'}"
    data-region-handles={cropSession.mode}
    style="left: {localCrop.left * 100}%; top: {localCrop.top * 100}%; width: {(localCrop.right - localCrop.left) * 100}%; height: {(localCrop.bottom - localCrop.top) * 100}%;"
    aria-hidden="true"
    onpointerdown={(e) => coversImage ? startDraw(e) : startHandle(e, "move")}
    onpointermove={onMove}
    onpointerup={endGesture}
    onpointercancel={endGesture}
  >
    {#each [...edges, ...corners] as handle (handle)}
      <div
        class="absolute {handleClass[handle]} {handleTone} pointer-events-auto rounded-sm"
        aria-hidden="true"
        onpointerdown={(e) => startHandle(e, handle)}
        onpointermove={onMove}
        onpointerup={endGesture}
        onpointercancel={endGesture}
      ></div>
    {/each}
  </div>
{/if}
