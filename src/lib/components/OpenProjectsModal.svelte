<script lang="ts">
  import { doc, deleteProject, listProjects, requestNewDocument, requestOpenProject } from "../stores/documentStore.svelte.ts";
  import { ui, hideOpenProjects } from "../stores/uiStore.svelte.ts";
  import { trapTabFocus } from "../utils/focus.ts";
  import { getStorageEstimate, requestPersistentStorage, type StoredProjectMeta } from "../utils/projectStorage.ts";
  import { layoutsOpenElsewhere } from "../utils/layoutLock.ts";
  import Icon from "./Icon.svelte";

  let dialogEl: HTMLDivElement | undefined = $state();
  let closeButton: HTMLButtonElement | undefined = $state();
  let projects = $state<StoredProjectMeta[]>([]);
  let openElsewhere = $state<Set<string>>(new Set());
  let storage = $state<{ usage: number; quota: number; persisted: boolean } | null>(null);
  let loading = $state(false);
  let loadError = $state("");
  let pendingDeleteId = $state<string | null>(null);

  $effect(() => {
    if (!ui.showOpenProjects) {
      pendingDeleteId = null;
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    void refresh();
    requestAnimationFrame(() => closeButton?.focus());
    return () => { requestAnimationFrame(() => { if (previous?.isConnected) previous.focus(); }); };
  });

  async function refresh() {
    loading = true;
    loadError = "";
    try {
      [projects, openElsewhere, storage] = await Promise.all([listProjects(), layoutsOpenElsewhere(), getStorageEstimate()]);
    } catch {
      projects = [];
      loadError = "Could not read the layouts saved in this browser.";
    } finally {
      loading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (pendingDeleteId) pendingDeleteId = null;
      else hideOpenProjects();
      return;
    }
    trapTabFocus(e, dialogEl);
  }

  function openProject(id: string) {
    hideOpenProjects();
    requestOpenProject(id);
  }

  function newLayout() {
    hideOpenProjects();
    requestNewDocument("a4-portrait");
  }

  async function confirmDelete() {
    const id = pendingDeleteId;
    if (!id) return;
    pendingDeleteId = null;
    try {
      await deleteProject(id);
      await refresh();
    } catch {
      loadError = "Could not delete that layout.";
    }
  }

  async function keepLayouts() {
    await requestPersistentStorage();
    storage = await getStorageEstimate();
  }

  function formatSavedAt(updatedAt: number): string {
    if (!updatedAt) return "Unknown date";
    return new Date(updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  }

  function plural(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
  }

  function contentSummary(project: StoredProjectMeta): string {
    const images = project.imageCount ? `${plural(project.imageCount, "image")}, ${formatBytes(project.imageBytes)}` : "";
    return [project.pageName, plural(project.itemCount, "item"), images].filter(Boolean).join(" · ");
  }

  function storageSummary(estimate: { usage: number; quota: number }): string {
    const available = estimate.quota ? ` (${formatBytes(estimate.quota)} available)` : "";
    return `TinyCut is using ${formatBytes(estimate.usage)} of browser storage${available}.`;
  }
</script>

{#if ui.showOpenProjects}
  <div class="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="open-projects-title" tabindex="-1" bind:this={dialogEl} onkeydown={handleKeydown}>
    <div class="modal-box max-w-xl">
      <h3 id="open-projects-title" class="text-lg font-bold">Your layouts</h3>
      <p class="pt-2 text-sm text-base-content/70">
        Every layout, with its images, saves automatically in this browser's private storage on this device. They are not in your Downloads folder, and other browsers or computers cannot see them.
      </p>

      {#if loading}
        <p class="py-6 text-sm text-base-content/65">Reading saved layouts…</p>
      {:else if loadError}
        <p class="py-6 text-sm text-error">{loadError}</p>
      {:else if projects.length === 0}
        <p class="py-6 text-sm text-base-content/65">Nothing is saved yet. Add an image, shape, or text and this layout saves itself.</p>
      {:else}
        <ul class="project-list">
          {#each projects as project (project.id)}
            {@const current = project.id === doc.id}
            {@const elsewhere = openElsewhere.has(project.id)}
            <li class="project-row" class:current>
              <div class="min-w-0">
                <p class="font-medium truncate">
                  {project.name}
                  {#if current}<span class="badge badge-primary badge-sm ml-1 align-middle">This tab</span>{/if}
                  {#if elsewhere}<span class="badge badge-ghost badge-sm ml-1 align-middle">Open in another tab</span>{/if}
                </p>
                <p class="text-xs text-base-content/65">Edited {formatSavedAt(project.updatedAt)}</p>
                <p class="text-xs text-base-content/65">{contentSummary(project)}</p>
              </div>
              <div class="project-row-actions">
                <button
                  class="btn btn-sm btn-primary"
                  disabled={current || elsewhere}
                  title={elsewhere ? "Switch to the tab where this layout is open" : current ? "Already open in this tab" : "Open in this tab"}
                  onclick={() => openProject(project.id)}
                >Open</button>
                <button class="btn btn-sm btn-ghost btn-square" aria-label={`Delete ${project.name}`} title={elsewhere ? "Close it in the other tab before deleting it" : "Delete from this browser"} disabled={elsewhere} onclick={() => pendingDeleteId = project.id}><Icon name="trash" size={16} /></button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}

      {#if pendingDeleteId}
        {@const pending = projects.find((project) => project.id === pendingDeleteId)}
        <div class="alert mt-4 text-sm">
          <span>Delete “{pending?.name ?? "this layout"}” and its images from this browser? This cannot be undone.</span>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-ghost" onclick={() => pendingDeleteId = null}>Cancel</button>
            <button class="btn btn-sm btn-error" onclick={() => void confirmDelete()}>Delete</button>
          </div>
        </div>
      {/if}

      {#if storage}
        <div class="mt-4 rounded-box bg-base-200 p-3 text-xs text-base-content/70 space-y-1" data-storage-summary>
          <p>{storageSummary(storage)} Images used by several layouts are stored once.</p>
          {#if storage.persisted}
            <p><Icon name="shield" size={14} /> The browser will not clear these files on its own. Clearing this site's data still deletes them.</p>
          {:else}
            <p>The browser may clear this storage if the device runs low on space. <button class="link link-primary" onclick={() => void keepLayouts()}>Ask the browser to keep it</button></p>
          {/if}
        </div>
      {/if}

      <div class="modal-action">
        <button class="btn btn-ghost mr-auto" onclick={newLayout}><Icon name="file" size={16} />New layout</button>
        <button class="btn" bind:this={closeButton} onclick={hideOpenProjects}>Close</button>
      </div>
    </div>
    <button type="button" class="modal-backdrop" aria-label="Close" onclick={hideOpenProjects}></button>
  </div>
{/if}
