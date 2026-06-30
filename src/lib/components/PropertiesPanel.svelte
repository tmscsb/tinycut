<script lang="ts">
  import { doc, getSelectedItem } from "../stores/documentStore.svelte.ts";
  import PageSettingsPanel from "./PageSettingsPanel.svelte";
  import ImageSettingsPanel from "./ImageSettingsPanel.svelte";
  import ShapeSettingsPanel from "./ShapeSettingsPanel.svelte";
  import TextSettingsPanel from "./TextSettingsPanel.svelte";
  import LayersPanel from "./LayersPanel.svelte";

  const selected = $derived(getSelectedItem());
</script>

<aside class="no-print w-64 xl:w-72 bg-base-100 border-l border-base-300 overflow-y-auto flex-shrink-0 shadow-sm" aria-label="Properties and layers">
  <div class="p-4 xl:p-5">
    {#if doc.selectedItemIds.length > 1}
      <div class="alert alert-info py-2 px-3 mb-4 text-xs">Editing the primary item. Move, duplicate, and delete affect all selected items.</div>
    {/if}
    {#if selected}
      {#if selected.type === "image"}
        <ImageSettingsPanel item={selected} />
      {:else if selected.type === "shape"}
        <ShapeSettingsPanel item={selected} />
      {:else if selected.type === "text"}
        <TextSettingsPanel item={selected} />
      {/if}
    {:else}
      <PageSettingsPanel />
    {/if}
    <LayersPanel />
  </div>
</aside>
