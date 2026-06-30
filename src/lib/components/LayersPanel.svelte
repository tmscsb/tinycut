<script lang="ts">
  import { doc, selectItem, bringForward, sendBackward } from "../stores/documentStore.svelte.ts";
</script>

<div class="border-t border-base-300 pt-4 mt-5">
  <div class="flex items-center justify-between mb-2">
    <h4 class="text-xs font-semibold uppercase tracking-wide text-base-content/60">Layers</h4>
    {#if doc.selectedItemIds.length > 1}<span class="badge badge-primary badge-sm">{doc.selectedItemIds.length} selected</span>{/if}
  </div>
  {#if doc.items.length === 0}
    <p class="text-xs text-base-content/45 py-2">No items yet</p>
  {:else}
    <div class="space-y-1">
      {#each [...doc.items].reverse() as item (item.id)}
        <div class="flex items-center gap-1 rounded-box" class:bg-primary={doc.selectedItemIds.includes(item.id)} class:text-primary-content={doc.selectedItemIds.includes(item.id)}>
          <button class="btn btn-ghost btn-sm flex-1 justify-start min-w-0" onclick={(e) => selectItem(item.id, e.shiftKey)} title="Shift-click to multi-select">
            <span class="badge badge-xs">{item.type === "shape" ? (item.shapeType === "ellipse" ? "circle" : item.shapeType) : item.type}</span>
            <span class="truncate">{item.name}</span>
          </button>
          <button class="btn btn-ghost btn-xs" aria-label={`Move ${item.name} up`} onclick={() => bringForward(item.id)}>↑</button>
          <button class="btn btn-ghost btn-xs" aria-label={`Move ${item.name} down`} onclick={() => sendBackward(item.id)}>↓</button>
        </div>
      {/each}
    </div>
  {/if}
</div>
