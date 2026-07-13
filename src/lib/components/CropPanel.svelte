<script lang="ts">
  import type { ImageItem, ImageCrop } from "../types/document.ts";
  import { setCrop, exitCropMode } from "../stores/documentStore.svelte.ts";

  let { item }: { item: ImageItem } = $props();

  let cropLeft = $state("");
  let cropTop = $state("");
  let cropRight = $state("");
  let cropBottom = $state("");

  let lastAppliedCrop = $state<ImageCrop | null>(null);

  $effect(() => {
    const c = item.crop;
    if (!lastAppliedCrop || lastAppliedCrop.left !== c.left || lastAppliedCrop.top !== c.top || lastAppliedCrop.right !== c.right || lastAppliedCrop.bottom !== c.bottom) {
      cropLeft = String((c.left * 100).toFixed(1));
      cropTop = String((c.top * 100).toFixed(1));
      cropRight = String(((1 - c.right) * 100).toFixed(1));
      cropBottom = String(((1 - c.bottom) * 100).toFixed(1));
      lastAppliedCrop = { ...c };
    }
  });

  function applyCrop() {
    let left = parseFloat(cropLeft) / 100;
    let top = parseFloat(cropTop) / 100;
    let right = 1 - parseFloat(cropRight) / 100;
    let bottom = 1 - parseFloat(cropBottom) / 100;

    if (isNaN(left) || left < 0) left = 0;
    if (isNaN(top) || top < 0) top = 0;
    if (isNaN(right) || right > 1) right = 1;
    if (isNaN(bottom) || bottom > 1) bottom = 1;
    if (right - left < 0.01) right = Math.min(1, left + 0.01);
    if (bottom - top < 0.01) bottom = Math.min(1, top + 0.01);

    const crop: ImageCrop = { left, top, right, bottom };
    lastAppliedCrop = { ...crop };
    setCrop(item.id, crop);
    exitCropMode();
  }
</script>

<div class="space-y-3">
  <h4 class="text-xs font-medium text-base-content/65 uppercase tracking-wide">Trim from edge (%)</h4>

  <div class="grid grid-cols-2 gap-2">
    <div>
      <label class="block text-xs text-base-content/60 mb-1" for={`crop-left-${item.id}`}>Left trim</label>
      <input
        id={`crop-left-${item.id}`}
        type="number"
        class="input input-bordered input-sm w-full"
        min="0" max="100" step="0.5"
        bind:value={cropLeft}
      />
    </div>
    <div>
      <label class="block text-xs text-base-content/60 mb-1" for={`crop-top-${item.id}`}>Top trim</label>
      <input
        id={`crop-top-${item.id}`}
        type="number"
        class="input input-bordered input-sm w-full"
        min="0" max="100" step="0.5"
        bind:value={cropTop}
      />
    </div>
  </div>

  <div class="grid grid-cols-2 gap-2">
    <div>
      <label class="block text-xs text-base-content/60 mb-1" for={`crop-right-${item.id}`}>Right trim</label>
      <input
        id={`crop-right-${item.id}`}
        type="number"
        class="input input-bordered input-sm w-full"
        min="0" max="100" step="0.5"
        bind:value={cropRight}
      />
    </div>
    <div>
      <label class="block text-xs text-base-content/60 mb-1" for={`crop-bottom-${item.id}`}>Bottom trim</label>
      <input
        id={`crop-bottom-${item.id}`}
        type="number"
        class="input input-bordered input-sm w-full"
        min="0" max="100" step="0.5"
        bind:value={cropBottom}
      />
    </div>
  </div>

  <button
    class="btn btn-sm btn-warning w-full"
    onclick={applyCrop}
  >
    Apply Crop
  </button>
</div>
