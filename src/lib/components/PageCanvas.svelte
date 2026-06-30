<script lang="ts">
  import { doc } from "../stores/documentStore.svelte.ts";
  import { mmToPx } from "../utils/units.ts";
  import ImageObject from "./ImageObject.svelte";
  import ShapeObject from "./ShapeObject.svelte";

  const pagePxWidth = $derived(mmToPx(doc.page.widthMm, doc.zoom));
  const pagePxHeight = $derived(mmToPx(doc.page.heightMm, doc.zoom));
</script>

<div class="print-page-container relative pb-8">
  <div
    class="print-page bg-white shadow-xl relative"
    style="width: {pagePxWidth}px; height: {pagePxHeight}px"
  >
    {#each doc.items as item (item.id)}
      {#if item.type === "image"}
        <ImageObject item={item} />
      {:else if item.type === "shape"}
        <ShapeObject item={item} />
      {/if}
    {/each}
  </div>

  <div class="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs text-base-content/50 whitespace-nowrap font-medium">
    {doc.page.name} — {doc.page.widthMm.toFixed(1)} × {doc.page.heightMm.toFixed(1)} mm
  </div>
</div>
