<script lang="ts">
  import TopToolbar from "./lib/components/TopToolbar.svelte";
  import Workspace from "./lib/components/Workspace.svelte";
  import PropertiesPanel from "./lib/components/PropertiesPanel.svelte";
  import ShortcutsModal from "./lib/components/ShortcutsModal.svelte";
  import ContextMenu from "./lib/components/ContextMenu.svelte";
  import OpenProjectsModal from "./lib/components/OpenProjectsModal.svelte";
  import {
    doc,
    bootDocument,
    saveProject,
    requestLoadFromHash,
    requestOpenProjects,
    deleteSelectedItem,
    duplicateSelectedItem,
    enterCropMode,
    enterCutMode,
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
    selectAll,
    copySelection,
    cutSelection,
    pasteItems,
    hasClipboardItems,
    takePendingSystemCopy,
    addImage,
    hasUnsavedWork,
    flushAutosave,
  } from "./lib/stores/documentStore.svelte.ts";
  import { CLIPBOARD_MIME, clipboardLabel, parseClipboardPayload } from "./lib/utils/clipboard.ts";
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
    showNotice,
  } from "./lib/stores/uiStore.svelte.ts";
  import { onMount } from "svelte";
  import { trapTabFocus } from "./lib/utils/focus.ts";
  import { preparePrintSurface, removePrintSurface } from "./lib/utils/printDocument.ts";

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
    void bootDocument();
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

    /** Clipboard shortcuts act on layout items unless the user is working with text. */
    function itemClipboardActive(): boolean {
      if (ui.showUnsavedWarning || ui.showShortcuts || ui.showOpenProjects || ui.contextMenu) return false;
      if (isInputFocused()) return false;
      const selection = window.getSelection();
      return !selection || selection.isCollapsed;
    }

    // Ctrl+C/X/V work from keydown, because not every browser fires clipboard
    // events when nothing is selected. When the browser does fire them, the
    // events also put the items on the system clipboard for other tabs.
    let pasteEventSeen = false;

    function handleClipboardKey(key: "c" | "x" | "v") {
      if (!itemClipboardActive()) return;
      if (key === "v") {
        pasteEventSeen = false;
        setTimeout(() => { if (!pasteEventSeen && itemClipboardActive()) void pasteItems(); }, 0);
        return;
      }
      if (key === "x") cutSelection();
      else copySelection();
    }

    function handleCopy(e: ClipboardEvent, cut: boolean) {
      const payload = takePendingSystemCopy()
        ?? (itemClipboardActive() ? (cut ? cutSelection() : copySelection()) : null);
      takePendingSystemCopy();
      if (!payload) return;
      e.preventDefault();
      e.clipboardData?.setData(CLIPBOARD_MIME, JSON.stringify(payload));
      e.clipboardData?.setData("text/plain", clipboardLabel(payload));
    }

    async function handlePaste(e: ClipboardEvent) {
      pasteEventSeen = true;
      if (!itemClipboardActive()) return;
      const data = e.clipboardData;
      const payload = parseClipboardPayload(data?.getData(CLIPBOARD_MIME) ?? "");
      if (payload) {
        e.preventDefault();
        await pasteItems(payload);
        return;
      }
      const images = Array.from(data?.files ?? []).filter((file) => file.type.startsWith("image/"));
      if (images.length) {
        e.preventDefault();
        for (const file of images) {
          try { await addImage(file); }
          catch (error) { showNotice(error instanceof Error ? error.message : "The pasted image could not be added", "error"); }
        }
        return;
      }
      // Some browsers drop custom clipboard types; our label still identifies our own copy.
      if (hasClipboardItems() && (data?.getData("text/plain") ?? "").startsWith("TinyCut: ")) {
        e.preventDefault();
        await pasteItems();
      }
    }

    const onCopy = (e: ClipboardEvent) => handleCopy(e, false);
    const onCut = (e: ClipboardEvent) => handleCopy(e, true);
    const onPaste = (e: ClipboardEvent) => { void handlePaste(e); };

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
      if (ui.showOpenProjects) return;
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
        queueMicrotask(() => { void saveProject(); });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        requestOpenProjects();
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

      if (mod && !e.altKey && !e.shiftKey && ["c", "x", "v"].includes(e.key.toLowerCase())) {
        handleClipboardKey(e.key.toLowerCase() as "c" | "x" | "v");
        return;
      }

      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAll();
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

      if (!mod && !e.altKey && e.key === "Enter" && doc.cropModeItemId) {
        if ((e.target as HTMLElement | null)?.closest("button, a, summary, select")) return;
        e.preventDefault();
        const cropForm = document.querySelector<HTMLFormElement>(".crop-panel-form");
        if (cropForm) cropForm.requestSubmit();
        else exitCropMode();
        return;
      }

      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoom(doc.zoom * 1.25);
        return;
      }

      if (mod && e.key === "-") {
        e.preventDefault();
        setZoom(doc.zoom / 1.25);
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
        (e.key.toLowerCase() === "c" || e.key.toLowerCase() === "x") &&
        doc.selectedItemId &&
        !doc.cropModeItemId
      ) {
        const item = getItem(doc.selectedItemId);
        if (item?.type === "image") {
          e.preventDefault();
          if (e.key.toLowerCase() === "x") enterCutMode(item.id);
          else enterCropMode(item.id);
        }
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
      if (hasUnsavedWork()) {
        void flushAutosave();
        e.preventDefault();
        e.returnValue = "";
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") void flushAutosave();
    }

    function onBeforePrint() {
      preparePrintSurface(doc);
    }
    function onAfterPrint() {
      removePrintSurface();
    }

    window.addEventListener("keydown", handleKeydown);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("hashchange", requestLoadFromHash);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("hashchange", requestLoadFromHash);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
      compactLayoutQuery.removeEventListener("change", syncCompactLayout);
      removePrintSurface();
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
<OpenProjectsModal />

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
      <h3 id="unsaved-title" class="text-lg font-bold">This layout is not saved</h3>
      <p class="py-4 text-base-content/70">
        The latest changes could not be saved in this browser and will be lost. Download a backup from the Project menu first if you want to keep them.
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" bind:this={unsavedCancelButton} onclick={cancelPendingAction}>Cancel</button>
        <button class="btn btn-warning" onclick={executePendingAction}>Discard &amp; Continue</button>
      </div>
    </div>
    <button type="button" class="modal-backdrop" aria-label="Close" onclick={cancelPendingAction}></button>
  </div>
{/if}
