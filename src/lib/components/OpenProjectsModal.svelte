<script lang="ts">
  import { doc, deleteProject, listProjects, requestOpenProject } from "../stores/documentStore.svelte.ts";
  import { ui, hideOpenProjects } from "../stores/uiStore.svelte.ts";
  import { trapTabFocus } from "../utils/focus.ts";
  import type { StoredProjectMeta } from "../utils/projectStorage.ts";
  import Icon from "./Icon.svelte";

  let dialogEl: HTMLDivElement | undefined = $state();
  let closeButton: HTMLButtonElement | undefined = $state();
  let projects = $state<StoredProjectMeta[]>([]);
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
      projects = await listProjects();
    } catch {
      projects = [];
      loadError = "Could not read layouts saved in this browser.";
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

  function formatSavedAt(updatedAt: number): string {
    if (!updatedAt) return "Unknown date";
    return new Date(updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }
</script>

{#if ui.showOpenProjects}
  <div class="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="open-projects-title" tabindex="-1" bind:this={dialogEl} onkeydown={handleKeydown}>
    <div class="modal-box max-w-lg">
      <h3 id="open-projects-title" class="text-lg font-bold">Open a saved layout</h3>
      <p class="py-2 text-sm text-base-content/70">
        These files live in this browser on this device, not in your Downloads folder. A new tab always starts empty.
      </p>

      {#if loading}
        <p class="py-6 text-sm text-base-content/65">Reading saved layouts…</p>
      {:else if loadError}
        <p class="py-6 text-sm text-error">{loadError}</p>
      {:else if projects.length === 0}
        <p class="py-6 text-sm text-base-content/65">No layouts are saved in this browser yet. Press Save to keep this page.</p>
      {:else}
        <ul class="project-list">
          {#each projects as project}
            <li class="project-row" class:current={project.id === doc.id}>
              <div class="min-w-0">
                <p class="font-medium truncate">{project.name}</p>
                <p class="text-xs text-base-content/65">{formatSavedAt(project.updatedAt)}{#if project.id === doc.id} · This tab{/if}</p>
              </div>
              <div class="project-row-actions">
                <button class="btn btn-sm btn-primary" onclick={() => openProject(project.id)}>Open</button>
                <button class="btn btn-sm btn-ghost btn-square" aria-label={`Delete ${project.name}`} title="Delete from this browser" onclick={() => pendingDeleteId = project.id}><Icon name="trash" size={16} /></button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}

      {#if pendingDeleteId}
        {@const pending = projects.find((project) => project.id === pendingDeleteId)}
        <div class="alert mt-4 text-sm">
          <span>Delete “{pending?.name ?? "this layout"}” from this browser? This cannot be undone.</span>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-ghost" onclick={() => pendingDeleteId = null}>Cancel</button>
            <button class="btn btn-sm btn-error" onclick={() => void confirmDelete()}>Delete</button>
          </div>
        </div>
      {/if}

      <div class="modal-action">
        <button class="btn" bind:this={closeButton} onclick={hideOpenProjects}>Close</button>
      </div>
    </div>
    <button type="button" class="modal-backdrop" aria-label="Close" onclick={hideOpenProjects}></button>
  </div>
{/if}
