<script lang="ts">
  import type { ResizeHandle } from "../utils/resizeGeometry.ts";

  let { pxW, pxH, onResizeStart, onResizeMove, onResizeEnd, resizing }: {
    pxW: number;
    pxH: number;
    onResizeStart: (e: PointerEvent, handle: ResizeHandle) => void;
    onResizeMove: (e: PointerEvent) => void;
    onResizeEnd: (e: PointerEvent) => void;
    resizing: boolean;
  } = $props();

  const HANDLE_SIZE = 10;
  const handles: { id: ResizeHandle; x: number; y: number; cursor: string }[] = $derived([
    { id: "nw", x: 0, y: 0, cursor: "nw-resize" },
    { id: "n", x: pxW / 2, y: 0, cursor: "n-resize" },
    { id: "ne", x: pxW, y: 0, cursor: "ne-resize" },
    { id: "e", x: pxW, y: pxH / 2, cursor: "e-resize" },
    { id: "se", x: pxW, y: pxH, cursor: "se-resize" },
    { id: "s", x: pxW / 2, y: pxH, cursor: "s-resize" },
    { id: "sw", x: 0, y: pxH, cursor: "sw-resize" },
    { id: "w", x: 0, y: pxH / 2, cursor: "w-resize" },
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
      cursor: {h.cursor};
    "
    aria-hidden="true"
    onpointerdown={(e) => onResizeStart(e, h.id)}
    onpointermove={(e) => resizing && onResizeMove(e)}
    onpointerup={onResizeEnd}
    onpointercancel={onResizeEnd}
  ></div>
{/each}
