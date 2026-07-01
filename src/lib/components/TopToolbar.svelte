<script lang="ts">
  import {
    doc,
    requestNewDocument,
    addImage,
    addShape,
    addText,
    saveToLocalStorage,
    requestLoadFromLocalStorage,
    setZoom,
    setUnit,
    exportJson,
    requestImportJson,
    undo,
    redo,
    undoState,
    exitCropMode,
  } from "../stores/documentStore.svelte.ts";
  import { ZOOM_LEVELS, PAGE_TEMPLATES } from "../types/document.ts";
  import { exportDocumentAsPng } from "../utils/exportPng.ts";
  import { ui, toggleTheme, showShortcuts, showNotice } from "../stores/uiStore.svelte.ts";

  let fileInput: HTMLInputElement | undefined = $state();
  let importInput: HTMLInputElement | undefined = $state();
  let exportingPng = $state(false);
  let pngDpi = $state(600);

  const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");
  const modKey = isMac ? "⌘" : "Ctrl";

  function handleImageFile(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      addImage(file).then(() => {
        target.value = "";
      }).catch(() => {
        target.value = "";
        showNotice("The selected image could not be loaded", "error");
      });
    }
  }

  function handleImportJson(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      requestImportJson(file);
      target.value = "";
    }
  }

  async function handleExportPng() {
    if (exportingPng) return;
    exportingPng = true;
    try {
      const blob = await exportDocumentAsPng(doc, pngDpi);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "trimkit-export.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      showNotice("The PNG export could not be created", "error");
    } finally {
      exportingPng = false;
    }
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
    exitCropMode();
    requestAnimationFrame(() => window.print());
  }
</script>

<div class="no-print navbar gap-2 px-3 py-2 bg-base-100 border-b border-base-300 shadow-sm flex-wrap h-auto min-h-0">
  <!-- Brand -->
  <div class="flex items-center gap-1.5">
    <img src="/trimkit-icon.svg" alt="TrimKit" width="20" height="20" class="rounded" />
    <span class="text-sm font-semibold text-base-content/80 hidden xl:inline">TrimKit</span>
  </div>

  <div class="divider divider-horizontal mx-0 hidden xl:flex"></div>

  <!-- Undo / Redo -->
  <div class="join">
    <button
      class="join-item btn btn-sm btn-ghost"
      onclick={undo}
      disabled={!undoState.hasUndo}
      title="Undo"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
      <kbd class="kbd kbd-xs ml-0.5 hidden xl:inline-flex">{modKey}Z</kbd>
    </button>
    <button
      class="join-item btn btn-sm btn-ghost"
      onclick={redo}
      disabled={!undoState.hasRedo}
      title="Redo"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
      <kbd class="kbd kbd-xs ml-0.5 hidden xl:inline-flex">{modKey}Y</kbd>
    </button>
  </div>

  <div class="divider divider-horizontal mx-0 hidden xl:flex"></div>

  <!-- Document Actions -->
  <div class="flex items-center gap-2">
    <button
      class="btn btn-sm btn-ghost"
      onclick={() => requestNewDocument("a4-portrait")}
      title="New A4 document"
    >
      New
      <kbd class="kbd kbd-xs hidden xl:inline-flex">{modKey}N</kbd>
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

  <div class="divider divider-horizontal mx-0 hidden xl:flex"></div>

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
      aria-label="Add rectangle"
    >
      □
    </button>
    <button
      class="join-item btn btn-sm btn-outline"
      onclick={() => addShape("ellipse")}
      title="Add circle"
      aria-label="Add circle"
    >
      ○
    </button>
    <button
      class="join-item btn btn-sm btn-outline"
      onclick={() => addShape("line")}
      title="Add line"
      aria-label="Add line"
    >
      ╱
    </button>
    <button class="join-item btn btn-sm btn-outline" onclick={addText} title="Add text" aria-label="Add text">T</button>
  </div>
  <input
    type="file"
    accept="image/png,image/jpeg,image/webp,image/svg+xml"
    class="hidden"
    bind:this={fileInput}
    onchange={handleImageFile}
  />

  <div class="divider divider-horizontal mx-0 hidden xl:flex"></div>

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
      <kbd class="kbd kbd-xs ml-1 hidden xl:inline-flex">{modKey}-</kbd>
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
      <kbd class="kbd kbd-xs ml-1 hidden xl:inline-flex">{modKey}+</kbd>
    </button>
  </div>

  <button
    class="btn btn-sm btn-ghost hidden xl:inline-flex"
    onclick={() => setZoom(1)}
    title="Reset zoom"
  >
    100%
    <kbd class="kbd kbd-xs ml-1 hidden xl:inline-flex">{modKey}0</kbd>
  </button>

  <div class="divider divider-horizontal mx-0 hidden xl:flex"></div>

  <!-- Export & Print -->
  <div class="join">
    <button class="join-item btn btn-sm btn-ghost" onclick={handleExportPng} disabled={exportingPng} title={`Export as PNG at ${pngDpi} DPI`}>
      {exportingPng ? "Exporting…" : "PNG"}
    </button>
    <select
      class="join-item select select-sm select-bordered w-24"
      bind:value={pngDpi}
      disabled={exportingPng}
      title="PNG export resolution"
      aria-label="PNG export resolution"
    >
      <option value={300}>300 DPI</option>
      <option value={600}>600 DPI</option>
      <option value={1200}>1200 DPI</option>
    </select>
  </div>
  <button class="btn btn-sm btn-ghost" onclick={handlePrint} title="Print">
    Print
  </button>

  <div class="divider divider-horizontal mx-0 hidden xl:flex"></div>

  <!-- Project persistence -->
  <div class="dropdown dropdown-end">
    <button class="btn btn-sm {doc.dirty ? 'btn-warning' : 'btn-ghost'}" type="button" tabindex="0">
      Project
      {#if doc.dirty}<span class="badge badge-xs badge-warning"></span>{/if}
      <span aria-hidden="true">▾</span>
    </button>
    <ul class="dropdown-content menu bg-base-100 rounded-box z-50 w-52 p-2 shadow-xl border border-base-300">
      <li><button onclick={() => saveToLocalStorage()}>Save to browser <kbd class="kbd kbd-xs ml-auto">{modKey}S</kbd></button></li>
      <li><button onclick={requestLoadFromLocalStorage}>Load saved project</button></li>
      <li><button onclick={handleExportJson}>Export project JSON</button></li>
      <li><button onclick={() => importInput?.click()}>Import project JSON</button></li>
    </ul>
  </div>
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
