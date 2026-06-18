<script lang="ts">
  import TopToolbar from "./lib/components/TopToolbar.svelte";
  import Workspace from "./lib/components/Workspace.svelte";
  import PropertiesPanel from "./lib/components/PropertiesPanel.svelte";
  import ShortcutsModal from "./lib/components/ShortcutsModal.svelte";
  import {
    doc,
    loadFromLocalStorage,
    saveToLocalStorage,
    deleteSelectedItem,
    duplicateSelectedItem,
    exitCropMode,
    selectItem,
    nudgeItem,
    setZoom,
  } from "./lib/stores/documentStore.svelte.ts";
  import {
    ui,
    initTheme,
    showShortcuts,
    executePendingAction,
    cancelPendingAction,
  } from "./lib/stores/uiStore.svelte.ts";
  import { onMount } from "svelte";

  onMount(() => {
    initTheme();
    loadFromLocalStorage();

    function isInputFocused(): boolean {
      const t = document.activeElement as HTMLElement;
      return (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT" ||
        t.isContentEditable
      );
    }

    function handleKeydown(e: KeyboardEvent) {
      if (isInputFocused()) return;

      const mod = e.ctrlKey || e.metaKey;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelectedItem();
        return;
      }

      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelectedItem();
        return;
      }

      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveToLocalStorage();
        return;
      }

      if (e.key === "Escape") {
        if (doc.cropModeItemId) {
          exitCropMode();
        } else {
          selectItem(null);
        }
        return;
      }

      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoom(doc.zoom + 0.1);
        return;
      }

      if (mod && e.key === "-") {
        e.preventDefault();
        setZoom(doc.zoom - 0.1);
        return;
      }

      if (mod && e.key === "0") {
        e.preventDefault();
        setZoom(1);
        return;
      }

      if (!mod && e.key === "?") {
        e.preventDefault();
        showShortcuts();
        return;
      }

      if (doc.selectedItemId) {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowUp") {
          e.preventDefault();
          nudgeItem(doc.selectedItemId, 0, -step);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          nudgeItem(doc.selectedItemId, 0, step);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          nudgeItem(doc.selectedItemId, -step, 0);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          nudgeItem(doc.selectedItemId, step, 0);
        }
      }
    }

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (doc.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }

    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  });
</script>

<div class="h-full flex flex-col bg-base-200 print-page-container">
  <TopToolbar />
  <div class="flex flex-1 overflow-hidden">
    <Workspace />
    <PropertiesPanel />
  </div>
</div>

<ShortcutsModal />

{#if ui.showUnsavedWarning}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="text-lg font-bold">Unsaved Changes</h3>
      <p class="py-4 text-base-content/70">
        You have unsaved changes that will be lost. Are you sure you want to continue?
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" onclick={cancelPendingAction}>Cancel</button>
        <button class="btn btn-warning" onclick={executePendingAction}>Discard &amp; Continue</button>
      </div>
    </div>
    <button type="button" class="modal-backdrop" aria-label="Close" onclick={cancelPendingAction}></button>
  </div>
{/if}
