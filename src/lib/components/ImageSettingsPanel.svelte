<script lang="ts">
  import type { ImageItem } from "../types/document.ts";
  import {
    doc,
    setItemWidth,
    setItemHeight,
    setItemX,
    setItemY,
    setLockedAspect,
    deleteSelectedItem,
    duplicateSelectedItem,
    enterCropMode,
    resetCrop,
    setItemRotation,
  } from "../stores/documentStore.svelte.ts";
  import { formatDisplay, parseInputToMm } from "../utils/units.ts";
  import CropPanel from "./CropPanel.svelte";

  let { item }: { item: ImageItem } = $props();

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
  <!-- Header -->
  <div class="pb-3 border-b border-base-300">
    <h3 class="font-semibold text-base-content text-sm truncate" title={item.name}>{item.name}</h3>
    <p class="text-xs text-base-content/50 mt-0.5">Image properties</p>
  </div>

  <!-- Position -->
  <div>
    <h4 class="text-xs font-medium text-base-content/50 uppercase tracking-wide mb-2">Position</h4>
    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="block text-xs text-base-content/60 mb-1" for={`img-x-${item.id}`}>X ({doc.unit})</label>
        <input
          id={`img-x-${item.id}`}
          type="number"
          class="input input-bordered input-sm w-full"
          step={doc.unit === "cm" ? "0.1" : "1"}
          bind:value={dispX}
          onchange={applyX}
        />
      </div>
      <div>
        <label class="block text-xs text-base-content/60 mb-1" for={`img-y-${item.id}`}>Y ({doc.unit})</label>
        <input
          id={`img-y-${item.id}`}
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
    <h4 class="text-xs font-medium text-base-content/50 uppercase tracking-wide mb-2">Size</h4>
    <div class="grid grid-cols-2 gap-2 mb-2">
      <div>
        <label class="block text-xs text-base-content/60 mb-1" for={`img-w-${item.id}`}>Width ({doc.unit})</label>
        <input
          id={`img-w-${item.id}`}
          type="number"
          class="input input-bordered input-sm w-full"
          min={doc.unit === "cm" ? "0.1" : "1"}
          step={doc.unit === "cm" ? "0.1" : "1"}
          bind:value={dispW}
          onchange={applyW}
        />
      </div>
      <div>
        <label class="block text-xs text-base-content/60 mb-1" for={`img-h-${item.id}`}>Height ({doc.unit})</label>
        <input
          id={`img-h-${item.id}`}
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

  <label class="form-control">
    <span class="label text-xs">Rotation (degrees)</span>
    <input class="input input-bordered input-sm" type="number" step="1" value={item.rotationDeg} onchange={(e) => setItemRotation(item.id, Number(e.currentTarget.value))} />
  </label>

  <!-- Crop -->
  <div class="pt-3 border-t border-base-300">
    <h4 class="text-xs font-medium text-base-content/50 uppercase tracking-wide mb-2">Crop</h4>
    <div class="space-y-2">
      {#if doc.cropModeItemId === item.id}
        <button
          class="btn btn-sm btn-warning w-full"
          onclick={() => enterCropMode(null)}
        >
          Exit Crop Mode
        </button>
      {:else}
        <button
          class="btn btn-sm btn-outline w-full"
          onclick={() => enterCropMode(item.id)}
        >
          Crop Image
        </button>
      {/if}

      <button
        class="btn btn-sm btn-ghost w-full"
        onclick={() => resetCrop(item.id)}
      >
        Reset Crop
      </button>
    </div>

    {#if doc.cropModeItemId === item.id}
      <div class="mt-3">
        <CropPanel {item} />
      </div>
    {/if}
  </div>

  <!-- Actions -->
  <div class="pt-3 border-t border-base-300">
    <h4 class="text-xs font-medium text-base-content/50 uppercase tracking-wide mb-2">Actions</h4>
    <div class="grid grid-cols-2 gap-2">
      <button
        class="btn btn-sm btn-outline"
        onclick={duplicateSelectedItem}
      >
        Duplicate
      </button>
      <button
        class="btn btn-sm btn-error btn-outline"
        onclick={deleteSelectedItem}
      >
        Delete
      </button>
    </div>
  </div>
</div>
