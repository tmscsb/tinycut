<script lang="ts">
  import { doc, requestNewDocument, setPageSize } from "../stores/documentStore.svelte.ts";
  import { PAGE_TEMPLATES } from "../types/document.ts";

  let customW = $state(String(doc.page.widthMm));
  let customH = $state(String(doc.page.heightMm));

  function applyCustom() {
    const w = parseFloat(customW);
    const h = parseFloat(customH);
    if (w > 0 && h > 0) setPageSize(w, h);
  }
</script>

<div class="space-y-5">
  <!-- Header -->
  <div class="pb-3 border-b border-base-300">
    <h3 class="font-semibold text-base-content text-sm">Page Settings</h3>
    <p class="text-xs text-base-content/50 mt-0.5">Configure your document</p>
  </div>

  <!-- Template -->
  <div>
    <h4 class="text-xs font-medium text-base-content/50 uppercase tracking-wide mb-2">Template</h4>
    <select
      id="template-select"
      class="select select-bordered select-sm w-full"
      value={doc.page.templateId}
      onchange={(e) => requestNewDocument((e.target as HTMLSelectElement).value)}
    >
      {#each PAGE_TEMPLATES as tpl}
        <option value={tpl.id}>{tpl.name}</option>
      {/each}
    </select>
  </div>

  <!-- Current Size -->
  <div class="bg-base-200 rounded-lg p-3 border border-base-300">
    <p class="text-xs text-base-content/60">
      <span class="font-medium">Current size:</span>
      <span class="text-base-content">{doc.page.widthMm.toFixed(1)} × {doc.page.heightMm.toFixed(1)} mm</span>
    </p>
  </div>

  <!-- Custom Size -->
  <div class="pt-3 border-t border-base-300">
    <h4 class="text-xs font-medium text-base-content/50 uppercase tracking-wide mb-2">Custom Size (mm)</h4>
    <div class="flex gap-2 mb-2">
      <div class="flex-1">
        <label class="block text-xs text-base-content/60 mb-1" for="custom-width">Width</label>
        <input
          id="custom-width"
          type="number"
          class="input input-bordered input-sm w-full"
          min="10"
          step="1"
          bind:value={customW}
        />
      </div>
      <div class="flex-1">
        <label class="block text-xs text-base-content/60 mb-1" for="custom-height">Height</label>
        <input
          id="custom-height"
          type="number"
          class="input input-bordered input-sm w-full"
          min="10"
          step="1"
          bind:value={customH}
        />
      </div>
    </div>
    <button
      class="btn btn-sm btn-primary w-full"
      onclick={applyCustom}
    >
      Apply Custom Size
    </button>
  </div>
</div>
