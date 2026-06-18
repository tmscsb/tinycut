<script lang="ts">
  import { getSelectedItem } from "../stores/documentStore.svelte.ts";
  import PageSettingsPanel from "./PageSettingsPanel.svelte";
  import ImageSettingsPanel from "./ImageSettingsPanel.svelte";

  const selected = $derived(getSelectedItem());
</script>

<div class="no-print w-72 bg-base-100 border-l border-base-300 overflow-y-auto flex-shrink-0 shadow-sm">
  <div class="p-5">
    {#if selected}
      <ImageSettingsPanel item={selected} />
    {:else}
      <PageSettingsPanel />
    {/if}
  </div>
</div>
