<script lang="ts">
  import Icon from "./Icon.svelte";
  import {
    centerSelectedOnPage,
    deleteSelectedItem,
    duplicateSelectedItem,
  } from "../stores/documentStore.svelte.ts";
</script>

<div class="pt-3 border-t border-base-300 space-y-3">
  <div>
    <h4 class="text-xs font-medium text-base-content/65 uppercase tracking-wide mb-2">Align to page</h4>
    <div class="grid grid-cols-2 gap-2">
      <button
        type="button"
        class="btn btn-sm btn-outline"
        title="Center horizontally on the page"
        onclick={() => centerSelectedOnPage("horizontal")}
      >
        <Icon name="center-x" size={16} />Center X
      </button>
      <button
        type="button"
        class="btn btn-sm btn-outline"
        title="Center vertically on the page"
        onclick={() => centerSelectedOnPage("vertical")}
      >
        <Icon name="center-y" size={16} />Center Y
      </button>
    </div>
  </div>

  <div>
    <h4 class="text-xs font-medium text-base-content/65 uppercase tracking-wide mb-2">Actions</h4>
    <div class="grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-sm btn-outline" onclick={duplicateSelectedItem}><Icon name="copy" size={16} />Duplicate</button>
      <button type="button" class="btn btn-sm btn-error btn-outline" onclick={deleteSelectedItem}><Icon name="trash" size={16} />Delete</button>
    </div>
  </div>
</div>
