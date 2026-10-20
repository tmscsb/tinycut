<script lang="ts">
  import { doc, getSelectedItem, matchSelectionSize, setSelectionSize } from "../stores/documentStore.svelte.ts";
  import type { SizeAxis } from "../utils/resizeGeometry.ts";
  import { formatDisplay, parseInputToMm } from "../utils/units.ts";
  import SelectionActions from "./SelectionActions.svelte";

  const selected = $derived(doc.items.filter((item) => doc.selectedItemIds.includes(item.id)));
  const primary = $derived(getSelectedItem());
  const anyLocked = $derived(selected.some((item) => item.lockedAspectRatio));

  /** The shared value, or "" when the selected items differ. */
  function common(axis: SizeAxis): string {
    const values = new Set(selected.map((item) => formatDisplay(axis === "width" ? item.widthMm : item.heightMm, doc.unit)));
    return values.size === 1 ? [...values][0] : "";
  }

  function apply(axis: SizeAxis, input: HTMLInputElement) {
    const value = parseFloat(input.value);
    if (Number.isFinite(value) && value > 0) setSelectionSize(axis, parseInputToMm(value, doc.unit));
    input.value = common(axis);
  }
</script>

<div class="space-y-5">
  <div class="pb-3 border-b border-base-300">
    <h3 class="font-semibold text-base-content text-sm">{selected.length} items selected</h3>
    <p class="text-xs text-base-content/65 mt-0.5">Changes here apply to every selected item.</p>
  </div>

  <div>
    <h4 class="text-xs font-medium text-base-content/65 uppercase tracking-wide mb-2">Size</h4>
    <div class="grid grid-cols-2 gap-2 mb-2">
      {#each ["width", "height"] as const as axis (axis)}
        <div>
          <label class="block text-xs text-base-content/60 mb-1" for={`selection-${axis}`}>{axis === "width" ? "Width" : "Height"} ({doc.unit})</label>
          <input
            id={`selection-${axis}`}
            type="number"
            class="input input-bordered input-sm w-full"
            min={doc.unit === "cm" ? "0.1" : "1"}
            step={doc.unit === "cm" ? "0.1" : "1"}
            placeholder="Mixed"
            value={common(axis)}
            onchange={(e) => apply(axis, e.currentTarget)}
          />
        </div>
      {/each}
    </div>
    {#if primary}
      <div class="grid grid-cols-2 gap-2">
        <button type="button" class="btn btn-sm btn-outline" title={`Give every selected item the width of “${primary.name}”`} onclick={() => matchSelectionSize("width")}>Same width</button>
        <button type="button" class="btn btn-sm btn-outline" title={`Give every selected item the height of “${primary.name}”`} onclick={() => matchSelectionSize("height")}>Same height</button>
      </div>
      <p class="text-xs text-base-content/60 mt-2">“Same” copies from the last item you selected, {primary.name}.</p>
      {#if anyLocked}<p class="text-xs text-base-content/60 mt-1">Items with a locked aspect ratio keep their proportions.</p>{/if}
    {/if}
  </div>

  <SelectionActions />
</div>
