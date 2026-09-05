<script lang="ts">
  import { getRotatedResizeCursor, type ResizeHandle } from "../utils/resizeGeometry.ts";

  let { pxW, pxH, rotationDeg, onResizeStart, onResizeMove, onResizeEnd, resizing }: {
    pxW: number;
    pxH: number;
    rotationDeg: number;
    onResizeStart: (e: PointerEvent, handle: ResizeHandle) => void;
    onResizeMove: (e: PointerEvent) => void;
    onResizeEnd: (e: PointerEvent) => void;
    resizing: boolean;
  } = $props();

  const HANDLE_SIZE = 10;
  const handles: { id: ResizeHandle; x: number; y: number }[] = $derived([
    { id: "nw", x: 0, y: 0 },
    { id: "n", x: pxW / 2, y: 0 },
    { id: "ne", x: pxW, y: 0 },
    { id: "e", x: pxW, y: pxH / 2 },
    { id: "se", x: pxW, y: pxH },
    { id: "s", x: pxW / 2, y: pxH },
    { id: "sw", x: 0, y: pxH },
    { id: "w", x: 0, y: pxH / 2 },
  ]);
</script>

{#each handles as h}
  <div
    data-resize-handle
    class="absolute bg-base-100 border-2 border-primary rounded-sm pointer-events-auto z-20"
    style="
      left: {h.x - HANDLE_SIZE / 2}px;
      top: {h.y - HANDLE_SIZE / 2}px;
      width: {HANDLE_SIZE}px;
      height: {HANDLE_SIZE}px;
      cursor: {getRotatedResizeCursor(h.id, rotationDeg)};
    "
    aria-hidden="true"
    onpointerdown={(e) => onResizeStart(e, h.id)}
    onpointermove={(e) => resizing && onResizeMove(e)}
    onpointerup={onResizeEnd}
    onpointercancel={onResizeEnd}
  ></div>
{/each}
