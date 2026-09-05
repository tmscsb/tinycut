<script lang="ts">
  import { doc } from "../stores/documentStore.svelte.ts";
  import { mmToPx } from "../utils/units.ts";
  import ImageObject from "./ImageObject.svelte";
  import ShapeObject from "./ShapeObject.svelte";
  import TextObject from "./TextObject.svelte";
  import Icon from "./Icon.svelte";

  const pagePxWidth = $derived(mmToPx(doc.page.widthMm, doc.zoom));
  const pagePxHeight = $derived(mmToPx(doc.page.heightMm, doc.zoom));
  const gridPx = $derived(mmToPx(doc.gridSizeMm, doc.zoom));

  $effect(() => {
    const styleId = "trimkit-print-page-size";
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `@media print { @page { size: ${doc.page.widthMm}mm ${doc.page.heightMm}mm; margin: 0; } }`;
  });
</script>

<div class="print-page-container relative pb-8" style="--page-w: {doc.page.widthMm}mm; --page-h: {doc.page.heightMm}mm;">
  <div
    class="print-page bg-white shadow-xl relative overflow-visible"
    class:page-grid={doc.showGrid}
    style="width: {pagePxWidth}px; height: {pagePxHeight}px; --grid-size: {gridPx}px"
  >
    {#if doc.items.length === 0}
      <div class="no-print absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div class="text-center text-slate-500 max-w-64">
          <div class="inline-flex rounded-2xl bg-slate-50 p-4 text-slate-400 mb-3"><Icon name="image" size={28} /></div>
          <p class="text-sm font-semibold text-slate-700">Your next layout starts here</p>
          <p class="text-xs leading-relaxed mt-2">Drop images onto the page, or add images, shapes, and text from the toolbar.</p>
          <p class="text-xs mt-4">Free to use. Your files stay in your browser.</p>
        </div>
      </div>
    {/if}
    {#if doc.showGuides}
      <div class="no-print absolute inset-y-0 left-1/2 border-l border-dashed border-info/45 pointer-events-none z-30"></div>
      <div class="no-print absolute inset-x-0 top-1/2 border-t border-dashed border-info/45 pointer-events-none z-30"></div>
    {/if}
    {#each doc.items as item, index (item.id)}
      {#if item.type === "image"}
        <ImageObject item={item} zIndex={index + 1} />
      {:else if item.type === "shape"}
        <ShapeObject item={item} zIndex={index + 1} />
      {:else if item.type === "text"}
        <TextObject item={item} zIndex={index + 1} />
      {/if}
    {/each}
  </div>

  <div class="no-print absolute bottom-0 left-1/2 -translate-x-1/2 text-xs text-base-content/65 whitespace-nowrap font-medium">
    {doc.page.name} — {doc.page.widthMm.toFixed(1)} × {doc.page.heightMm.toFixed(1)} mm
  </div>
</div>
