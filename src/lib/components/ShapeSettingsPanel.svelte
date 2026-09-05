<script lang="ts">
  import type { ShapeItem } from "../types/document.ts";
  import {
    doc,
    setItemWidth,
    setItemHeight,
    setItemX,
    setItemY,
    setLockedAspect,
    setShapeFill,
    setShapeStroke,
    setShapeStrokeWidth,
    setShapeCornerRadius,
  } from "../stores/documentStore.svelte.ts";
  import { displayValue, formatDisplay, parseInputToMm } from "../utils/units.ts";
  import SelectionActions from "./SelectionActions.svelte";
  import RotationControl from "./RotationControl.svelte";

  let { item }: { item: ShapeItem } = $props();

  let dispX = $state("");
  let dispY = $state("");
  let dispW = $state("");
  let dispH = $state("");

  $effect(() => {
    dispX = formatDisplay(item.xMm, doc.unit);
    dispY = formatDisplay(item.yMm, doc.unit);
    dispW = formatDisplay(item.widthMm, doc.unit);
    dispH = formatDisplay(item.heightMm, doc.unit);
  });

  function applyX() {
    const v = parseFloat(dispX);
    if (!isNaN(v)) setItemX(item.id, parseInputToMm(v, doc.unit));
  }
  function applyY() {
    const v = parseFloat(dispY);
    if (!isNaN(v)) setItemY(item.id, parseInputToMm(v, doc.unit));
  }
  function applyW() {
    const v = parseFloat(dispW);
    if (!isNaN(v) && v > 0) setItemWidth(item.id, parseInputToMm(v, doc.unit));
  }
  function applyH() {
    const v = parseFloat(dispH);
    if (!isNaN(v) && v > 0) setItemHeight(item.id, parseInputToMm(v, doc.unit));
  }
</script>

<div class="space-y-5">
  <div class="pb-3 border-b border-base-300">
    <h3 class="font-semibold text-base-content text-sm truncate" title={item.name}>{item.name}</h3>
    <p class="text-xs text-base-content/65 mt-0.5 capitalize">{item.shapeType === "rect" ? "Rectangle" : item.shapeType === "ellipse" ? "Ellipse" : "Line"} properties</p>
  </div>

  <!-- Position -->
  <div>
    <h4 class="text-xs font-medium text-base-content/65 uppercase tracking-wide mb-2">Position</h4>
    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="block text-xs text-base-content/60 mb-1" for={`shp-x-${item.id}`}>X ({doc.unit})</label>
        <input
          id={`shp-x-${item.id}`}
          type="number"
          class="input input-bordered input-sm w-full"
          step={doc.unit === "cm" ? "0.1" : "1"}
          bind:value={dispX}
          onchange={applyX}
        />
      </div>
      <div>
        <label class="block text-xs text-base-content/60 mb-1" for={`shp-y-${item.id}`}>Y ({doc.unit})</label>
        <input
          id={`shp-y-${item.id}`}
          type="number"
          class="input input-bordered input-sm w-full"
          step={doc.unit === "cm" ? "0.1" : "1"}
          bind:value={dispY}
          onchange={applyY}
        />
      </div>
    </div>
  </div>

  <!-- Size -->
  <div>
    <h4 class="text-xs font-medium text-base-content/65 uppercase tracking-wide mb-2">Size</h4>
    <div class="grid grid-cols-2 gap-2 mb-2">
      <div>
        <label class="block text-xs text-base-content/60 mb-1" for={`shp-w-${item.id}`}>Width ({doc.unit})</label>
        <input
          id={`shp-w-${item.id}`}
          type="number"
          class="input input-bordered input-sm w-full"
          min={doc.unit === "cm" ? "0.1" : "1"}
          step={doc.unit === "cm" ? "0.1" : "1"}
          bind:value={dispW}
          onchange={applyW}
        />
      </div>
      <div>
        <label class="block text-xs text-base-content/60 mb-1" for={`shp-h-${item.id}`}>Height ({doc.unit})</label>
        <input
          id={`shp-h-${item.id}`}
          type="number"
          class="input input-bordered input-sm w-full"
          min={doc.unit === "cm" ? "0.1" : "1"}
          step={doc.unit === "cm" ? "0.1" : "1"}
          bind:value={dispH}
          onchange={applyH}
        />
      </div>
    </div>
    <label class="label cursor-pointer justify-start gap-2 py-1">
      <input
        type="checkbox"
        class="checkbox checkbox-sm checkbox-primary"
        checked={item.lockedAspectRatio}
        onchange={() => setLockedAspect(item.id, !item.lockedAspectRatio)}
      />
      <span class="label-text text-xs">Lock aspect ratio</span>
    </label>
  </div>

  <RotationControl id={item.id} rotationDeg={item.rotationDeg} />

  <!-- Appearance -->
  {#if item.shapeType !== "line"}
    <div>
      <h4 class="text-xs font-medium text-base-content/65 uppercase tracking-wide mb-2">Fill</h4>
      <input
        type="color"
        class="w-10 h-8 rounded cursor-pointer"
        value={item.fill}
        onchange={(e) => setShapeFill(item.id, (e.target as HTMLInputElement).value)}
        title="Fill color"
        aria-label="Fill color"
      />
    </div>
  {/if}

  <div>
    <h4 class="text-xs font-medium text-base-content/65 uppercase tracking-wide mb-2">Stroke</h4>
    <div class="flex items-center gap-2">
      <input
        type="color"
        class="w-10 h-8 rounded cursor-pointer"
        value={item.stroke}
        onchange={(e) => setShapeStroke(item.id, (e.target as HTMLInputElement).value)}
        title="Stroke color"
        aria-label="Stroke color"
      />
      <div class="flex-1">
        <label class="block text-xs text-base-content/60 mb-1" for={`shp-sw-${item.id}`}>Stroke width ({doc.unit})</label>
        <input
          id={`shp-sw-${item.id}`}
          type="number"
          class="input input-bordered input-sm w-full"
          min="0" step="0.1"
          value={displayValue(item.strokeWidthMm, doc.unit)}
          onchange={(e) => setShapeStrokeWidth(item.id, parseInputToMm(parseFloat((e.target as HTMLInputElement).value) || 0, doc.unit))}
        />
      </div>
    </div>
  </div>

  {#if item.shapeType === "rect"}
    <div>
      <h4 class="text-xs font-medium text-base-content/65 uppercase tracking-wide mb-2">Corner Radius</h4>
      <input
        id={`shp-cr-${item.id}`}
        aria-label={`Corner radius (${doc.unit})`}
        type="number"
        class="input input-bordered input-sm w-full"
        min="0" step="0.5"
        value={displayValue(item.cornerRadiusMm, doc.unit)}
        onchange={(e) => setShapeCornerRadius(item.id, parseInputToMm(parseFloat((e.target as HTMLInputElement).value) || 0, doc.unit))}
      />
    </div>
  {/if}

  <SelectionActions />
</div>
