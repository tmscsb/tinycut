<script lang="ts">
  import {
    doc,
    selectItem,
    moveItemsByDelta,
    addImage,
    beginUndo,
    snapValue,
  } from "../stores/documentStore.svelte.ts";
  import { showContextMenu } from "../stores/uiStore.svelte.ts";
  import { pxToMm } from "../utils/units.ts";
  import PageCanvas from "./PageCanvas.svelte";

  let workspaceEl: HTMLDivElement | undefined = $state();

  let dragging = $state(false);
  let dragItemId = $state<string | null>(null);
  let dragStartPx = $state({ x: 0, y: 0 });
  let dragStartMm = $state({ x: 0, y: 0 });
  let dragStarts = $state<Record<string, { xMm: number; yMm: number }>>({});

  let panning = $state(false);
  let panStart = $state({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  let isFileDragOver = $state(false);

  function handlePointerDown(e: PointerEvent) {
    const target = e.target as HTMLElement;

    if (e.button === 1) {
      e.preventDefault();
      panning = true;
      panStart = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: workspaceEl?.scrollLeft ?? 0,
        scrollTop: workspaceEl?.scrollTop ?? 0,
      };
      return;
    }

    if (e.button !== 0) return;
    if (target.closest("[data-resize-handle]") || target.closest("[data-no-deselect]")) return;

    dragging = true;
    const itemEl = target.closest("[data-image-item]") as HTMLElement | null;
    if (itemEl) {
      const itemId = itemEl.dataset.imageItem;
      if (itemId) {
        if (e.shiftKey) {
          selectItem(itemId, true);
          dragging = false;
          return;
        }
        selectItem(itemId);
        dragItemId = itemId;
        const item = doc.items.find((i) => i.id === itemId);
        if (item) {
          beginUndo();
          dragStartMm = { x: item.xMm, y: item.yMm };
          dragStarts = Object.fromEntries(
            doc.items
              .filter((candidate) => doc.selectedItemIds.includes(candidate.id))
              .map((candidate) => [candidate.id, { xMm: candidate.xMm, yMm: candidate.yMm }]),
          );
          dragStartPx = { x: e.clientX, y: e.clientY };
        }
        (itemEl as HTMLElement).setPointerCapture(e.pointerId);
      }
    } else {
      if (!e.shiftKey) selectItem(null);
    }
  }

  function handlePointerMove(e: PointerEvent) {
    if (panning) {
      if (workspaceEl) {
        workspaceEl.scrollLeft = panStart.scrollLeft - (e.clientX - panStart.x);
        workspaceEl.scrollTop = panStart.scrollTop - (e.clientY - panStart.y);
      }
      return;
    }

    if (!dragging || !dragItemId) return;

    const dxPx = e.clientX - dragStartPx.x;
    const dyPx = e.clientY - dragStartPx.y;

    const targetX = snapValue(dragStartMm.x + pxToMm(dxPx, doc.zoom));
    const targetY = snapValue(dragStartMm.y + pxToMm(dyPx, doc.zoom));
    moveItemsByDelta(doc.selectedItemIds, targetX - dragStartMm.x, targetY - dragStartMm.y, dragStarts);
  }

  function handlePointerUp(e: PointerEvent) {
    if (panning) {
      panning = false;
      return;
    }
    dragging = false;
    dragItemId = null;
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer?.types.includes("Files")) {
      isFileDragOver = true;
    }
  }

  function handleDragLeave(e: DragEvent) {
    const relatedTarget = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      isFileDragOver = false;
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isFileDragOver = false;

    const files = e.dataTransfer?.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) {
        addImage(file);
      }
    }
  }

  function handleContextMenu(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const itemEl = target.closest("[data-image-item]") as HTMLElement | null;
    if (itemEl) {
      const itemId = itemEl.dataset.imageItem;
      if (itemId) {
        e.preventDefault();
        selectItem(itemId);
        showContextMenu(e.clientX, e.clientY, itemId);
      }
    }
  }

  const cursorClass = $derived(panning ? "cursor-grabbing" : "cursor-default");
</script>

<svelte:window onpointerup={handlePointerUp} />

<div
  class="workspace-bg flex-1 overflow-auto relative {cursorClass}"
  class:panning={panning}
  class:dragging={dragging}
  bind:this={workspaceEl}
  role="application"
  aria-label="Workspace"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onauxclick={(e) => e.preventDefault()}
  ondragover={handleDragOver}
  ondragenter={handleDragEnter}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  oncontextmenu={handleContextMenu}
>
  <div class="min-h-full flex items-start justify-center p-8">
    <PageCanvas />
  </div>

  {#if isFileDragOver}
    <div class="absolute inset-0 bg-primary/10 border-4 border-dashed border-primary pointer-events-none z-50 flex items-center justify-center">
      <div class="bg-base-100/90 px-8 py-4 rounded-lg shadow-lg text-lg font-medium text-primary">
        Drop images here
      </div>
    </div>
  {/if}
</div>
