<script lang="ts">
  import Icon from "./Icon.svelte";
  import { doc, getSelectedItem, selectItem } from "../stores/documentStore.svelte.ts";
  import PageSettingsPanel from "./PageSettingsPanel.svelte";
  import ImageSettingsPanel from "./ImageSettingsPanel.svelte";
  import ShapeSettingsPanel from "./ShapeSettingsPanel.svelte";
  import TextSettingsPanel from "./TextSettingsPanel.svelte";
  import LayersPanel from "./LayersPanel.svelte";
  import { ui, closeMobilePanel } from "../stores/uiStore.svelte.ts";
  import { trapTabFocus } from "../utils/focus.ts";

  const selected = $derived(getSelectedItem());
  let closeButton: HTMLButtonElement | undefined = $state();
  let panel: HTMLElement | undefined = $state();

  $effect(() => {
    if (!ui.compactLayout || !ui.mobilePanelOpen) return;
    requestAnimationFrame(() => closeButton?.focus());
    return () => {
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".properties-trigger")?.focus());
    };
  });
</script>

{#if ui.mobilePanelOpen}
  <button
    type="button"
    class="properties-backdrop no-print"
    aria-label="Close properties panel"
    onclick={closeMobilePanel}
  ></button>
{/if}

<aside
  class="properties-panel no-print w-64 xl:w-72 bg-base-100 border-l border-base-300 overflow-y-auto flex-shrink-0 shadow-sm"
  class:properties-panel-open={ui.mobilePanelOpen}
  aria-label="Properties and layers"
  aria-hidden={ui.compactLayout && !ui.mobilePanelOpen}
  inert={ui.compactLayout && !ui.mobilePanelOpen}
  bind:this={panel}
  onkeydown={(e) => { if (ui.compactLayout && ui.mobilePanelOpen) trapTabFocus(e, panel); }}
>
  <div class="p-4 xl:p-5">
    <div class="properties-mobile-header">
      <span class="text-sm font-semibold">Inspector</span>
      <button type="button" class="btn btn-sm btn-ghost btn-circle" aria-label="Close properties panel" bind:this={closeButton} onclick={closeMobilePanel}><Icon name="close" /></button>
    </div>
    {#if doc.selectedItemIds.length > 1}
      <div class="alert alert-info py-2 px-3 mb-4 text-xs">Editing the primary item. Move, duplicate, and delete affect all selected items.</div>
    {/if}
    {#if selected}
      <button class="btn btn-xs btn-ghost mb-3" onclick={() => selectItem(null)}><Icon name="file" size={14} />Page settings</button>
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
