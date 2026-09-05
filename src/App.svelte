<script lang="ts">
  import TopToolbar from "./lib/components/TopToolbar.svelte";
  import Workspace from "./lib/components/Workspace.svelte";
  import PropertiesPanel from "./lib/components/PropertiesPanel.svelte";
  import ShortcutsModal from "./lib/components/ShortcutsModal.svelte";
  import ContextMenu from "./lib/components/ContextMenu.svelte";
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
    undo,
    redo,
    bringToFront,
    sendToBack,
    getItem,
    requestNewDocument,
    setItemRotation,
  } from "./lib/stores/documentStore.svelte.ts";
  import {
    ui,
    initTheme,
    showShortcuts,
    hideShortcuts,
    hideContextMenu,
    executePendingAction,
    cancelPendingAction,
    openMobilePanel,
    closeMobilePanel,
    setCompactLayout,
    requestFitPage,
  } from "./lib/stores/uiStore.svelte.ts";
  import { onMount } from "svelte";
  import { trapTabFocus } from "./lib/utils/focus.ts";

  let unsavedDialog: HTMLDivElement | undefined = $state();
  let unsavedCancelButton: HTMLButtonElement | undefined = $state();

  $effect(() => {
    if (!ui.showUnsavedWarning) return;
    const previous = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => unsavedCancelButton?.focus());
    return () => { requestAnimationFrame(() => { if (previous?.isConnected) previous.focus(); }); };
  });

  function handleUnsavedDialogKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancelPendingAction();
      return;
    }
    trapTabFocus(e, unsavedDialog);
  }

  onMount(() => {
    initTheme();
    loadFromLocalStorage(false);
    requestFitPage();
    const compactLayoutQuery = window.matchMedia("(max-width: 640px)");
    const syncCompactLayout = () => setCompactLayout(compactLayoutQuery.matches);
    syncCompactLayout();
    compactLayoutQuery.addEventListener("change", syncCompactLayout);

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
      if (ui.showUnsavedWarning) {
        if (e.key === "Escape") {
          e.preventDefault();
          cancelPendingAction();
        }
        return;
      }
      if (ui.showShortcuts) {
        if (e.key === "Escape") {
          e.preventDefault();
          hideShortcuts();
        }
        return;
      }
      if (ui.contextMenu) {
        if (e.key === "Escape") {
          e.preventDefault();
          hideContextMenu();
        }
        return;
      }
      if ((e.target as HTMLElement | null)?.closest(".top-toolbar details[open]")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        // Commit any pending numeric field before taking the saved snapshot.
        (document.activeElement as HTMLElement | null)?.blur();
        queueMicrotask(saveToLocalStorage);
        return;
      }
      if (ui.compactLayout && ui.mobilePanelOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          closeMobilePanel();
        }
        return;
      }
      if (isInputFocused()) return;

      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }

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

      if (mod && e.key.toLowerCase() === "n") {
        e.preventDefault();
        requestNewDocument("a4-portrait");
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

      if (mod && e.key === "]") {
        e.preventDefault();
        if (doc.selectedItemId) bringToFront(doc.selectedItemId);
        return;
      }

      if (mod && e.key === "[") {
        e.preventDefault();
        if (doc.selectedItemId) sendToBack(doc.selectedItemId);
        return;
      }

      if (!mod && e.key === "?") {
        e.preventDefault();
        showShortcuts();
        return;
      }

      if (
        !mod &&
        !e.altKey &&
        e.key.toLowerCase() === "r" &&
        doc.selectedItemId &&
        !doc.cropModeItemId
      ) {
        e.preventDefault();
        const item = getItem(doc.selectedItemId);
        if (item) setItemRotation(item.id, item.rotationDeg + (e.shiftKey ? -90 : 90));
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
      compactLayoutQuery.removeEventListener("change", syncCompactLayout);
    };
  });
</script>

<div class="h-full flex flex-col bg-base-200 app-shell">
  <TopToolbar />
  <main class="app-main flex flex-1 overflow-hidden" aria-label="Layout editor">
    <button
      type="button"
      class="properties-trigger no-print btn btn-sm btn-primary"
      aria-label="Open properties panel"
      aria-expanded={ui.mobilePanelOpen}
      onclick={openMobilePanel}
    >
      Properties
    </button>
    <Workspace />
    <PropertiesPanel />
  </main>
</div>

{#if ui.notice}
  <div class="toast toast-top toast-center z-[200] no-print" role={ui.notice.type === "error" ? "alert" : "status"} aria-live={ui.notice.type === "error" ? "assertive" : "polite"}>
    <div class="alert {ui.notice.type === 'success' ? 'alert-success' : ui.notice.type === 'error' ? 'alert-error' : 'alert-info'} shadow-lg py-2 px-4">
      <span>{ui.notice.message}</span>
    </div>
  </div>
{/if}

<ShortcutsModal />

{#if ui.contextMenu}
  {@const ctxItem = getItem(ui.contextMenu.itemId)}
  {#if ctxItem}
    <ContextMenu
      item={ctxItem}
      x={ui.contextMenu.x}
      y={ui.contextMenu.y}
      onclose={hideContextMenu}
    />
  {/if}
{/if}

{#if ui.showUnsavedWarning}
  <div class="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="unsaved-title" tabindex="-1" bind:this={unsavedDialog} onkeydown={handleUnsavedDialogKeydown}>
    <div class="modal-box">
      <h3 id="unsaved-title" class="text-lg font-bold">Unsaved Changes</h3>
      <p class="py-4 text-base-content/70">
        You have unsaved changes that will be lost. Are you sure you want to continue?
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" bind:this={unsavedCancelButton} onclick={cancelPendingAction}>Cancel</button>
        <button class="btn btn-warning" onclick={executePendingAction}>Discard &amp; Continue</button>
      </div>
    </div>
    <button type="button" class="modal-backdrop" aria-label="Close" onclick={cancelPendingAction}></button>
  </div>
{/if}
