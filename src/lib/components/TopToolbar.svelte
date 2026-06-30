<script lang="ts">
  import {
    doc,
    requestNewDocument,
    addImage,
    addShape,
    saveToLocalStorage,
    loadFromLocalStorage,
    setZoom,
    setUnit,
    exportJson,
    importJson,
    undo,
    redo,
    undoState,
  } from "../stores/documentStore.svelte.ts";
  import { ZOOM_LEVELS, PAGE_TEMPLATES } from "../types/document.ts";
  import { exportDocumentAsSvg } from "../utils/exportSvg.ts";
  import { ui, toggleTheme, showShortcuts } from "../stores/uiStore.svelte.ts";

  let fileInput: HTMLInputElement | undefined = $state();
  let importInput: HTMLInputElement | undefined = $state();

  const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");
  const modKey = isMac ? "⌘" : "Ctrl";

  function handleImageFile(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      addImage(file).then(() => {
        target.value = "";
      });
    }
  }

  function handleImportJson(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      importJson(file).then(() => {
        target.value = "";
      });
    }
  }

  function handleExportSvg() {
    const svg = exportDocumentAsSvg(doc);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trimkit-export.svg";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportJson() {
    const json = exportJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trimkit-project.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    window.print();
  }
</script>

<div class="no-print navbar gap-2 px-4 py-2 bg-base-100 border-b border-base-300 shadow-sm flex-wrap h-auto min-h-0">
  <!-- Brand -->
  <div class="flex items-center gap-1.5">
    <img src="/trimkit-icon.svg" alt="TrimKit" width="20" height="20" class="rounded" />
    <span class="text-sm font-semibold text-base-content/80 hidden sm:inline">TrimKit</span>
  </div>

  <div class="divider divider-horizontal mx-1 hidden sm:flex"></div>

  <!-- Undo / Redo -->
  <div class="join">
    <button
      class="join-item btn btn-sm btn-ghost"
      onclick={undo}
      disabled={!undoState.hasUndo}
      title="Undo"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
      <kbd class="kbd kbd-xs ml-0.5">{modKey}Z</kbd>
    </button>
    <button
      class="join-item btn btn-sm btn-ghost"
      onclick={redo}
      disabled={!undoState.hasRedo}
      title="Redo"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
      <kbd class="kbd kbd-xs ml-0.5">{modKey}Y</kbd>
    </button>
  </div>

  <div class="divider divider-horizontal mx-1"></div>

  <!-- Document Actions -->
  <div class="flex items-center gap-2">
    <button
      class="btn btn-sm btn-ghost"
      onclick={() => requestNewDocument("a4-portrait")}
      title="New A4 document"
    >
      New
      <kbd class="kbd kbd-xs">{modKey}N</kbd>
    </button>

    <select
      class="select select-sm select-bordered"
      value={doc.page.templateId}
      onchange={(e) => requestNewDocument((e.target as HTMLSelectElement).value)}
      title="Page template"
    >
      {#each PAGE_TEMPLATES as tpl}
        <option value={tpl.id}>{tpl.name}</option>
      {/each}
    </select>
  </div>

  <div class="divider divider-horizontal mx-1"></div>

  <!-- Add Image / Shapes -->
  <div class="join">
    <button
      class="join-item btn btn-sm btn-primary"
      onclick={() => fileInput?.click()}
      title="Import image"
    >
      + Image
    </button>
    <button
      class="join-item btn btn-sm btn-outline"
      onclick={() => addShape("rect")}
      title="Add rectangle"
    >
      □
    </button>
    <button
      class="join-item btn btn-sm btn-outline"
      onclick={() => addShape("ellipse")}
      title="Add ellipse"
    >
      ○
    </button>
    <button
      class="join-item btn btn-sm btn-outline"
      onclick={() => addShape("line")}
      title="Add line"
    >
      ╱
    </button>
  </div>
  <input
    type="file"
    accept="image/png,image/jpeg,image/webp,image/svg+xml"
    class="hidden"
    bind:this={fileInput}
    onchange={handleImageFile}
  />

  <div class="divider divider-horizontal mx-1"></div>

  <!-- Unit & Zoom -->
  <select
    class="select select-sm select-bordered w-16"
    value={doc.unit}
    onchange={(e) => setUnit((e.target as HTMLSelectElement).value as "mm" | "cm")}
    title="Measurement unit"
  >
    <option value="mm">mm</option>
    <option value="cm">cm</option>
  </select>

  <div class="join">
    <button
      class="join-item btn btn-sm"
      onclick={() => setZoom(Math.max(0.1, doc.zoom - 0.1))}
      title="Zoom out"
    >
      −
      <kbd class="kbd kbd-xs ml-1">{modKey}-</kbd>
    </button>

    <select
      class="join-item select select-sm w-20 text-center"
      value={doc.zoom}
      onchange={(e) => setZoom(Number((e.target as HTMLSelectElement).value))}
      title="Zoom level"
    >
      {#each [...ZOOM_LEVELS, 0.1, 0.2, 3, 4] as z}
        <option value={z}>{Math.round(z * 100)}%</option>
      {/each}
    </select>

    <button
      class="join-item btn btn-sm"
      onclick={() => setZoom(Math.min(5, doc.zoom + 0.1))}
      title="Zoom in"
    >
      +
      <kbd class="kbd kbd-xs ml-1">{modKey}+</kbd>
    </button>
  </div>

  <button
    class="btn btn-sm btn-ghost"
    onclick={() => setZoom(1)}
    title="Reset zoom"
  >
    100%
    <kbd class="kbd kbd-xs ml-1">{modKey}0</kbd>
  </button>

  <div class="divider divider-horizontal mx-1"></div>

  <!-- Export & Print -->
  <button class="btn btn-sm btn-ghost" onclick={handleExportSvg} title="Export as SVG">
    SVG
  </button>
  <button class="btn btn-sm btn-ghost" onclick={handlePrint} title="Print">
    Print
  </button>

  <div class="divider divider-horizontal mx-1"></div>

  <!-- Save/Load -->
  <button
    class="btn btn-sm {doc.dirty ? 'btn-warning' : 'btn-ghost'}"
    onclick={() => saveToLocalStorage()}
    title="Save to browser storage"
  >
    Save
    {#if doc.dirty}<span class="badge badge-xs badge-warning ml-1"></span>{/if}
    <kbd class="kbd kbd-xs ml-1">{modKey}S</kbd>
  </button>

  <button class="btn btn-sm btn-ghost" onclick={() => loadFromLocalStorage()} title="Load from browser storage">
    Load
  </button>
  <button class="btn btn-sm btn-ghost" onclick={handleExportJson} title="Export project as JSON">
    ↓ JSON
  </button>
  <button class="btn btn-sm btn-ghost" onclick={() => importInput?.click()} title="Import project JSON">
    ↑ JSON
  </button>
  <input type="file" accept=".json" class="hidden" bind:this={importInput} onchange={handleImportJson} />

  <div class="flex-1"></div>

  <!-- Theme toggle + Help -->
  <button
    class="btn btn-sm btn-ghost btn-circle"
    onclick={toggleTheme}
    title="Toggle dark/light theme"
  >
    {#if ui.theme === "dark"}
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
    {:else}
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    {/if}
  </button>

  <button
    class="btn btn-sm btn-ghost btn-circle"
    onclick={showShortcuts}
    title="Keyboard shortcuts"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  </button>
</div>
