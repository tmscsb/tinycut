<script lang="ts">
  import { doc, selectItem, bringForward, sendBackward } from "../stores/documentStore.svelte.ts";
</script>

<div class="border-t border-base-300 pt-4 mt-5">
  <div class="flex items-center justify-between mb-2">
    <h4 class="text-xs font-semibold uppercase tracking-wide text-base-content/60">Layers</h4>
    {#if doc.selectedItemIds.length > 1}<span class="badge badge-primary badge-sm">{doc.selectedItemIds.length} selected</span>{/if}
  </div>
  {#if doc.items.length === 0}
    <div class="rounded-box border border-dashed border-base-300 px-3 py-4 text-center">
      <p class="text-xs font-medium text-base-content/60">No layers yet</p>
      <p class="text-xs text-base-content/60 mt-1">Add an image, shape, or text from the toolbar.</p>
    </div>
  {:else}
    <div class="space-y-1">
      {#each [...doc.items].reverse() as item, index (item.id)}
        <div class="flex items-center gap-1 rounded-box" class:bg-primary={doc.selectedItemIds.includes(item.id)} class:text-primary-content={doc.selectedItemIds.includes(item.id)}>
          <button class="btn btn-ghost btn-sm flex-1 justify-start min-w-0" aria-pressed={doc.selectedItemIds.includes(item.id)} onclick={(e) => selectItem(item.id, e.shiftKey)} title="Shift-click to multi-select">
            <span class="badge badge-xs">{item.type === "shape" ? (item.shapeType === "ellipse" ? "circle" : item.shapeType) : item.type}</span>
            <span class="truncate">{item.name}</span>
          </button>
          <button class="btn btn-ghost btn-xs" aria-label={`Move ${item.name} up`} disabled={index === 0} onclick={() => bringForward(item.id)}>↑</button>
          <button class="btn btn-ghost btn-xs" aria-label={`Move ${item.name} down`} disabled={index === doc.items.length - 1} onclick={() => sendBackward(item.id)}>↓</button>
        </div>
      {/each}
    </div>
  {/if}
</div>
