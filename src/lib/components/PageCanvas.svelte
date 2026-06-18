<script lang="ts">
  import { doc } from "../stores/documentStore.svelte.ts";
  import { mmToPx } from "../utils/units.ts";
  import ImageObject from "./ImageObject.svelte";

  const pagePxWidth = $derived(mmToPx(doc.page.widthMm, doc.zoom));
  const pagePxHeight = $derived(mmToPx(doc.page.heightMm, doc.zoom));
</script>

<div class="print-page-container">
  <div
    class="print-page bg-base-100 shadow-xl relative"
    style="width: {pagePxWidth}px; height: {pagePxHeight}px"
  >
    {#each doc.items as item (item.id)}
      <ImageObject {item} />
    {/each}
  </div>

  <div class="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-base-content/50 whitespace-nowrap font-medium">
    {doc.page.name} — {doc.page.widthMm.toFixed(1)} × {doc.page.heightMm.toFixed(1)} mm
  </div>
</div>
