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
    setPageTemplate,
  } from "../stores/documentStore.svelte.ts";
  import { ZOOM_LEVELS, PAGE_TEMPLATES } from "../types/document.ts";
  import { exportDocumentAsPng, getPngExportDimensions } from "../utils/exportPng.ts";
  import {
    ui,
    requestFitPage,
    toggleTheme,
    toggleShortcutHints,
    showShortcuts,
    showNotice,
  } from "../stores/uiStore.svelte.ts";

  let fileInput: HTMLInputElement | undefined = $state();
  let importInput: HTMLInputElement | undefined = $state();
  let exportingPng = $state(false);
  let pngDpi = $state(600);
  let projectMenu: HTMLDetailsElement | undefined = $state();
  let exportMenu: HTMLDetailsElement | undefined = $state();
  import Icon from "./Icon.svelte";
  import { exportDocumentAsSvg } from "../utils/exportSvg.ts";
  import { tick } from "svelte";
  const dpiOptions = [300, 600, 1200];
  const pngDimensions = $derived(getPngExportDimensions(doc.page, pngDpi));
  const zoomOptions = $derived(
    [...new Set([0.1, 0.2, ...ZOOM_LEVELS, 3, 4, doc.zoom])].sort((a, b) => a - b),
  );

  const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");
  const modKey = isMac ? "⌘" : "Ctrl";

  $effect(() => {
    if (pngDimensions.supported) return;
    const fallback = [...dpiOptions]
      .reverse()
      .find((dpi) => getPngExportDimensions(doc.page, dpi).supported);
    if (fallback) pngDpi = fallback;
  });

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  async function handleImageFile(e: Event) {
    const target = e.target as HTMLInputElement;
    const files = Array.from(target.files ?? []);
    target.value = "";
    for (const file of files) {
      try { await addImage(file); }
      catch (error) { showNotice(error instanceof Error ? error.message : "The selected image could not be loaded", "error"); }
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
    if (!pngDimensions.supported) {
      showNotice("Choose a lower DPI for this page size", "error");
      return;
    }
    const exportDpi = pngDpi;
    exportingPng = true;
    try {
      const blob = await exportDocumentAsPng(doc, exportDpi);
      downloadBlob(blob, "trimkit-export.png");
      showNotice(`PNG exported at ${exportDpi} DPI`, "success");
    } catch {
      showNotice("The PNG export could not be created", "error");
    } finally {
      exportingPng = false;
    }
  }

  function handleExportJson() {
    closeMenus();
    const json = exportJson();
    downloadBlob(new Blob([json], { type: "application/json" }), "trimkit-project.json");
    showNotice("Project JSON exported", "success");
  }

  function handleExportSvg() {
    closeMenus();
    downloadBlob(new Blob([exportDocumentAsSvg(doc)], { type: "image/svg+xml" }), "trimkit-export.svg");
    showNotice("Layered SVG exported", "success");
  }

  async function handlePrint() {
    closeMenus();
    exitCropMode();
    await tick();
    await document.fonts.ready;
    const images = doc.items.filter((item) => item.type === "image");
    try {
      await Promise.all(images.map((item) => { const image = new Image(); image.src = item.src; return image.decode(); }));
      window.print();
    } catch {
      showNotice("An image could not be loaded. Check your images before printing.", "error");
    }
  }

  function closeMenus() {
    if (projectMenu) projectMenu.open = false;
    if (exportMenu) exportMenu.open = false;
  }

  function handleOutsidePointer(e: PointerEvent) {
    if (e.target instanceof Node && !projectMenu?.contains(e.target) && !exportMenu?.contains(e.target)) closeMenus();
  }

  function handleMenuKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      const open = projectMenu?.open ? projectMenu : exportMenu?.open ? exportMenu : undefined;
      if (open) { e.preventDefault(); e.stopPropagation(); closeMenus(); open.querySelector("summary")?.focus(); }
    }
  }
</script>

<svelte:window onpointerdown={handleOutsidePointer} onkeydown={handleMenuKey} />

<header class="top-toolbar no-print bg-base-100 border-b border-base-300">
  <div class="toolbar-header">
    <div class="toolbar-brand" aria-label="TrimKit">
      <img src="/trimkit-icon.svg" alt="" width="28" height="28" />
      <span>TrimKit</span>
      <span class="toolbar-tagline">Layouts made to print</span>
    </div>
    <div class="toolbar-spacer"></div>
    <span class="save-status" aria-live="polite">{doc.dirty ? "Unsaved changes" : "Up to date"}</span>
    <button class="btn btn-sm btn-ghost toolbar-save" onclick={saveToLocalStorage} aria-label="Save to browser" title={`Save to browser (${modKey}+S)`}><Icon name="save" /><span class="desktop-label">Save</span></button>
    <details class="dropdown dropdown-end" bind:this={projectMenu} ontoggle={() => { if (projectMenu?.open && exportMenu) exportMenu.open = false; }}>
      <summary class="btn btn-sm btn-ghost" aria-label="Project menu"><Icon name="folder" /><span>Project</span><Icon name="chevron" size={14} /></summary>
      <ul class="dropdown-content menu bg-base-100 rounded-box w-60 p-2 shadow-xl border border-base-300">
        <li><button onclick={() => { closeMenus(); requestNewDocument("a4-portrait"); }}><Icon name="file" />New document</button></li>
        <li><button onclick={() => { closeMenus(); saveToLocalStorage(); }}><Icon name="save" />Save to browser</button></li>
        <li><button onclick={() => { closeMenus(); requestLoadFromLocalStorage(); }}>Load saved project</button></li>
        <li><button onclick={handleExportJson}>Download project JSON</button></li>
        <li><button onclick={() => { closeMenus(); importInput?.click(); }}>Open project JSON</button></li>
        <li class="small-phone-help"><button onclick={() => { closeMenus(); showShortcuts(); }}><Icon name="help" />Keyboard shortcuts</button></li>
        <li class="menu-note">Saved in this browser only. Download a project file to keep a backup.</li>
      </ul>
    </details>
    <details class="dropdown dropdown-end" bind:this={exportMenu} ontoggle={() => { if (exportMenu?.open && projectMenu) projectMenu.open = false; }}>
      <summary class="btn btn-sm btn-primary" aria-label="Export menu"><Icon name="download" /><span>Export</span><Icon name="chevron" size={14} /></summary>
      <div class="dropdown-content export-menu bg-base-100 rounded-box w-64 p-3 shadow-xl border border-base-300">
        <label for="png-resolution" class="block text-xs font-medium mb-2">PNG resolution</label>
        <select id="png-resolution" class="select select-sm w-full" bind:value={pngDpi} disabled={exportingPng} aria-label="PNG export resolution">
          {#each dpiOptions as dpi}<option value={dpi} disabled={!getPngExportDimensions(doc.page, dpi).supported}>{dpi} DPI</option>{/each}
        </select>
        <p class="text-xs text-base-content/65 my-2">{pngDimensions.widthPx.toLocaleString()} × {pngDimensions.heightPx.toLocaleString()} pixels</p>
        <button class="btn btn-sm btn-primary w-full" onclick={handleExportPng} disabled={exportingPng || !pngDimensions.supported}><Icon name="image" />{exportingPng ? "Exporting…" : "Download PNG"}</button>
        {#if !pngDimensions.supported}<p class="text-xs text-error mt-2">This page is too large for PNG. Use SVG or print instead.</p>{/if}
        <button class="btn btn-sm btn-ghost w-full justify-start mt-2" onclick={handleExportSvg}><Icon name="download" />Download SVG</button>
        <button class="btn btn-sm btn-ghost w-full justify-start" onclick={handlePrint}><Icon name="print" />Print / Save as PDF</button>
        <p class="text-xs text-base-content/65 mt-2">Print at 100% scale with no margins or headers.</p>
      </div>
    </details>
    <button class="btn btn-sm btn-ghost btn-square theme-control" onclick={toggleTheme} title={ui.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} aria-label={ui.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}><Icon name={ui.theme === "dark" ? "sun" : "moon"} /></button>
    <button class="btn btn-sm btn-ghost btn-square help-control" onclick={showShortcuts} title="Keyboard shortcuts" aria-label="Keyboard shortcuts"><Icon name="help" /></button>
  </div>

  <div class="toolbar-tools">
    <div class="toolbar-group" role="group" aria-label="History">
      <button class="btn btn-sm btn-ghost btn-square" onclick={undo} disabled={!undoState.hasUndo} title={`Undo (${modKey}+Z)`} aria-label="Undo"><Icon name="undo" /></button>
      <button class="btn btn-sm btn-ghost btn-square" onclick={redo} disabled={!undoState.hasRedo} title={`Redo (${modKey}+Shift+Z)`} aria-label="Redo"><Icon name="redo" /></button>
    </div>
    <div class="toolbar-group insert-tools" role="group" aria-label="Add to page">
      <button class="btn btn-sm btn-primary" onclick={() => fileInput?.click()} title="Import PNG, JPG, WebP, or SVG images"><Icon name="image" />Image</button>
      <button class="btn btn-sm btn-ghost btn-square" onclick={() => addShape("rect")} title="Add rectangle" aria-label="Add rectangle"><Icon name="rectangle" /></button>
      <button class="btn btn-sm btn-ghost btn-square" onclick={() => addShape("ellipse")} title="Add circle" aria-label="Add circle"><Icon name="circle" /></button>
      <button class="btn btn-sm btn-ghost btn-square" onclick={() => addShape("line")} title="Add line" aria-label="Add line"><Icon name="line" /></button>
      <button class="btn btn-sm btn-ghost btn-square" onclick={addText} title="Add text" aria-label="Add text"><Icon name="text" /></button>
    </div>
    <div class="toolbar-group page-tools" role="group" aria-label="Page setup">
      <select class="select select-sm template-select" value={doc.page.templateId} onchange={(e) => setPageTemplate(e.currentTarget.value)} aria-label="Page template">
        {#if doc.page.templateId === "custom"}<option value="custom" disabled>Custom size</option>{/if}
        {#each PAGE_TEMPLATES as tpl}<option value={tpl.id}>{tpl.name}</option>{/each}
      </select>
      <select class="select select-sm unit-select" value={doc.unit} onchange={(e) => setUnit(e.currentTarget.value as "mm" | "cm")} aria-label="Measurement unit"><option value="mm">mm</option><option value="cm">cm</option></select>
    </div>
    <div class="toolbar-spacer"></div>
    <div class="toolbar-group zoom-tools" role="group" aria-label="Zoom">
      <button class="btn btn-sm btn-ghost btn-square" onclick={() => setZoom(doc.zoom - 0.1)} disabled={doc.zoom <= 0.1} title="Zoom out" aria-label="Zoom out"><Icon name="minus" size={16} /></button>
      <select class="select select-sm zoom-select" value={doc.zoom} onchange={(e) => setZoom(Number(e.currentTarget.value))} aria-label="Zoom level">{#each zoomOptions as z}<option value={z}>{Math.round(z * 100)}%</option>{/each}</select>
      <button class="btn btn-sm btn-ghost btn-square" onclick={() => setZoom(doc.zoom + 0.1)} disabled={doc.zoom >= 5} title="Zoom in" aria-label="Zoom in"><Icon name="plus" size={16} /></button>
      <button class="btn btn-sm btn-ghost" onclick={requestFitPage} title="Fit page in workspace"><Icon name="fit" size={16} />Fit</button>
      <button class="btn btn-sm btn-ghost btn-square hints-control" class:btn-active={ui.showShortcutHints} onclick={toggleShortcutHints} title="Toggle shortcut hints" aria-label="Toggle shortcut hints" aria-pressed={ui.showShortcutHints}><Icon name="keyboard" size={16} /></button>
    </div>
  </div>
  {#if ui.showShortcutHints}<div class="toolbar-hints"><span><kbd>{modKey}+Z</kbd> Undo</span><span><kbd>{modKey}+S</kbd> Save</span><span><kbd>R</kbd> Rotate</span><span><kbd>Shift+click</kbd> Select multiple</span><button onclick={showShortcuts}>All shortcuts</button></div>{/if}
</header>
<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" multiple class="hidden" bind:this={fileInput} onchange={handleImageFile} />
<input type="file" accept=".json,application/json" class="hidden" bind:this={importInput} onchange={handleImportJson} />
