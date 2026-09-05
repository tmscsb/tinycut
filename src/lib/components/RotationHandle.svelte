<script lang="ts">
  import {
    beginUndo,
    endUndo,
    updateItemRotation,
  } from "../stores/documentStore.svelte.ts";
  import {
    getMagneticCardinalRotation,
    pointerAngleDegrees,
    shortestAngleDelta,
    snapRotationDegrees,
  } from "../utils/rotationGeometry.ts";

  let { itemId, rotationDeg, pxW }: {
    itemId: string;
    rotationDeg: number;
    pxW: number;
  } = $props();

  let rotating = $state(false);
  let center = $state({ x: 0, y: 0 });
  let previousPointerAngle = $state(0);
  let rawRotation = $state(0);
  let lockedCardinal = $state<number | null>(null);

  function finishRotation(e: PointerEvent) {
    if (!rotating) return;
    rotating = false;
    lockedCardinal = null;
    endUndo();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may already have been released by the browser.
    }
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const itemElement = (e.currentTarget as HTMLElement).closest("[data-document-item]");
    if (!itemElement) return;
    const bounds = itemElement.getBoundingClientRect();
    center = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
    previousPointerAngle = pointerAngleDegrees(center.x, center.y, e.clientX, e.clientY);
    rawRotation = rotationDeg;
    lockedCardinal = null;
    rotating = true;
    beginUndo();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!rotating) return;
    const pointerAngle = pointerAngleDegrees(center.x, center.y, e.clientX, e.clientY);
    rawRotation += shortestAngleDelta(previousPointerAngle, pointerAngle);
    previousPointerAngle = pointerAngle;
    if (e.shiftKey) {
      lockedCardinal = null;
      updateItemRotation(itemId, snapRotationDegrees(rawRotation));
      return;
    }

    const magneticRotation = getMagneticCardinalRotation(rawRotation, lockedCardinal);
    lockedCardinal = magneticRotation.lockedCardinal;
    updateItemRotation(itemId, magneticRotation.degrees);
  }
</script>

<div
  class="no-print absolute pointer-events-none z-30"
  style="left: {pxW / 2}px; top: -34px;"
  aria-hidden="true"
>
  <div class="absolute left-[-0.5px] top-[17px] h-[17px] border-l border-primary"></div>
</div>

<button
  type="button"
  data-rotation-handle
  data-no-deselect
  class="no-print absolute z-40 flex h-7 w-7 items-center justify-center rounded-full border-2 border-primary bg-base-100 text-primary shadow-sm outline-none pointer-events-auto cursor-grab hover:bg-primary hover:text-primary-content focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:cursor-grabbing"
  class:rotation-handle-active={rotating}
  style="left: {pxW / 2}px; top: -34px; transform: translate(-50%, -50%) rotate({-rotationDeg}deg); touch-action: none;"
  title="Rotate (snaps near 90°; hold Shift for 15° increments)"
  aria-label="Rotate item. Drag to rotate; cardinal angles snap automatically. Hold Shift to snap to 15 degree increments."
  aria-pressed={rotating}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={finishRotation}
  onpointercancel={finishRotation}
  onlostpointercapture={finishRotation}
>
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 11a8 8 0 1 0-2.34 5.66" />
    <path d="M20 4v7h-7" />
  </svg>
</button>
