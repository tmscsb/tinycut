<script lang="ts">
  import {
    doc,
    selectItem,
    moveItemsByDelta,
    addImage,
    beginUndo,
    endUndo,
    snapValue,
    setZoom,
  } from "../stores/documentStore.svelte.ts";
  import { ui, showContextMenu, showNotice } from "../stores/uiStore.svelte.ts";
  import { mmToPx, pxToMm } from "../utils/units.ts";
  import {
    addPadding,
    expansionForScroll,
    INITIAL_CANVAS_PADDING_PX,
    needsExpansion,
    paddingCss,
    type CanvasPadding,
  } from "../utils/canvasExpansion.ts";
  import PageCanvas from "./PageCanvas.svelte";
  import { onMount } from "svelte";

  let workspaceEl: HTMLDivElement | undefined = $state();
  let stageEl: HTMLDivElement | undefined = $state();

  let dragging = $state(false);
  let dragItemId = $state<string | null>(null);
  let dragStartPx = $state({ x: 0, y: 0 });
  let dragStartScroll = { x: 0, y: 0 };
  let dragPointerPx = { x: 0, y: 0 };
  let autoScrollFrame = 0;
  let dragStartMm = $state({ x: 0, y: 0 });
  let dragStarts = $state<Record<string, { xMm: number; yMm: number }>>({});

  let panning = $state(false);
  let spaceHeld = $state(false);
  let canvasPad = $state<CanvasPadding>({
    top: INITIAL_CANVAS_PADDING_PX,
    right: INITIAL_CANVAS_PADDING_PX,
    bottom: INITIAL_CANVAS_PADDING_PX,
    left: INITIAL_CANVAS_PADDING_PX,
  });
  let expandingCanvas = false;
  let panStart = $state({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  let isFileDragOver = $state(false);
  let handledFitRequest = $state(0);
  let lastFitZoom: number | null = null;

  onMount(() => {
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (lastFitZoom === null || doc.zoom !== lastFitZoom) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fitPage);
    });
    if (workspaceEl) observer.observe(workspaceEl);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  });

  function fitPage() {
    if (!workspaceEl) return;
    const availableWidth = Math.max(80, workspaceEl.clientWidth - 64);
    const availableHeight = Math.max(80, workspaceEl.clientHeight - 96);
    const zoom = Math.min(
      availableWidth / mmToPx(doc.page.widthMm),
      availableHeight / mmToPx(doc.page.heightMm),
    );
    setZoom(Math.floor(zoom * 100) / 100);
    lastFitZoom = doc.zoom;
    requestAnimationFrame(() => centerPageInView());
  }

  function centerPageInView() {
    if (!workspaceEl) return;
    const pageEl = workspaceEl.querySelector<HTMLElement>(".print-page");
    if (!pageEl) {
      workspaceEl.scrollLeft = Math.max(0, (workspaceEl.scrollWidth - workspaceEl.clientWidth) / 2);
      workspaceEl.scrollTop = Math.max(0, (workspaceEl.scrollHeight - workspaceEl.clientHeight) / 2);
      return;
    }
    const view = workspaceEl.getBoundingClientRect();
    const page = pageEl.getBoundingClientRect();
    workspaceEl.scrollLeft += page.left + page.width / 2 - (view.left + view.width / 2);
    workspaceEl.scrollTop += page.top + page.height / 2 - (view.top + view.height / 2);
  }

  function applyCanvasPadding(next: CanvasPadding) {
    canvasPad = next;
    if (!stageEl) return;
    stageEl.style.padding = paddingCss(next);
    void stageEl.offsetHeight;
  }

  function ensureCanvasRoom(): boolean {
    if (!workspaceEl || expandingCanvas) return false;
    expandingCanvas = true;
    let expanded = false;
    try {
      for (let i = 0; i < 8; i++) {
        const delta = expansionForScroll({
          scrollLeft: workspaceEl.scrollLeft,
          scrollTop: workspaceEl.scrollTop,
          scrollWidth: workspaceEl.scrollWidth,
          scrollHeight: workspaceEl.scrollHeight,
          clientWidth: workspaceEl.clientWidth,
          clientHeight: workspaceEl.clientHeight,
        });
        if (!needsExpansion(delta)) break;
        applyCanvasPadding(addPadding(canvasPad, delta));
        workspaceEl.scrollLeft += delta.left;
        workspaceEl.scrollTop += delta.top;
        panStart.scrollLeft += delta.left;
        panStart.scrollTop += delta.top;
        dragStartScroll.x += delta.left;
        dragStartScroll.y += delta.top;
        expanded = true;
      }
    } finally {
      expandingCanvas = false;
    }
    return expanded;
  }

  $effect(() => {
    const request = ui.fitPageRequest;
    if (request === 0 || request === handledFitRequest) return;
    handledFitRequest = request;
    requestAnimationFrame(fitPage);
  });

  function handlePointerDown(e: PointerEvent) {
    const target = e.target as HTMLElement;

    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      e.preventDefault();
      panning = true;
      panStart = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: workspaceEl?.scrollLeft ?? 0,
        scrollTop: workspaceEl?.scrollTop ?? 0,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (e.button !== 0) return;
    if (target.closest("[data-resize-handle]") || target.closest("[data-no-deselect]")) return;

    dragging = false;
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
          dragging = true;
          beginUndo();
          dragStartMm = { x: item.xMm, y: item.yMm };
          dragStarts = Object.fromEntries(
            doc.items
              .filter((candidate) => doc.selectedItemIds.includes(candidate.id))
              .map((candidate) => [candidate.id, { xMm: candidate.xMm, yMm: candidate.yMm }]),
          );
          dragStartPx = { x: e.clientX, y: e.clientY };
          dragPointerPx = { ...dragStartPx };
          dragStartScroll = { x: workspaceEl?.scrollLeft ?? 0, y: workspaceEl?.scrollTop ?? 0 };
        }
        (itemEl as HTMLElement).setPointerCapture(e.pointerId);
      }
    } else {
      dragItemId = null;
      if (!e.shiftKey) selectItem(null);
    }
  }

  function handlePointerMove(e: PointerEvent) {
    if (panning) {
      if (workspaceEl) {
        workspaceEl.scrollLeft = panStart.scrollLeft - (e.clientX - panStart.x);
        workspaceEl.scrollTop = panStart.scrollTop - (e.clientY - panStart.y);
        if (ensureCanvasRoom()) {
          workspaceEl.scrollLeft = panStart.scrollLeft - (e.clientX - panStart.x);
          workspaceEl.scrollTop = panStart.scrollTop - (e.clientY - panStart.y);
        }
      }
      return;
    }

    if (!dragging || !dragItemId) return;

    dragPointerPx = { x: e.clientX, y: e.clientY };
    if (!autoScrollFrame) autoScrollFrame = requestAnimationFrame(autoScrollWhileDragging);
    moveDraggedItems();
  }

  function moveDraggedItems() {
    if (!dragging || !dragItemId) return;
    const dxPx = dragPointerPx.x - dragStartPx.x + (workspaceEl?.scrollLeft ?? 0) - dragStartScroll.x;
    const dyPx = dragPointerPx.y - dragStartPx.y + (workspaceEl?.scrollTop ?? 0) - dragStartScroll.y;

    const targetX = snapValue(dragStartMm.x + pxToMm(dxPx, doc.zoom));
    const targetY = snapValue(dragStartMm.y + pxToMm(dyPx, doc.zoom));
    moveItemsByDelta(doc.selectedItemIds, targetX - dragStartMm.x, targetY - dragStartMm.y, dragStarts);
  }

  function autoScrollWhileDragging() {
    autoScrollFrame = 0;
    if (!dragging || !workspaceEl) return;
    const bounds = workspaceEl.getBoundingClientRect();
    const edge = 48;
    const speed = (position: number, start: number, end: number) =>
      position < start + edge ? -Math.min(24, (start + edge - position) / 2)
        : position > end - edge ? Math.min(24, (position - end + edge) / 2) : 0;
    const dx = speed(dragPointerPx.x, bounds.left, bounds.right);
    const dy = speed(dragPointerPx.y, bounds.top, bounds.bottom);
    if (dx || dy) {
      workspaceEl.scrollLeft += dx;
      workspaceEl.scrollTop += dy;
      ensureCanvasRoom();
      moveDraggedItems();
      autoScrollFrame = requestAnimationFrame(autoScrollWhileDragging);
    }
  }

  function handlePointerUp(e: PointerEvent) {
    if (panning) {
      panning = false;
    }
    dragging = false;
    if (autoScrollFrame) cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame = 0;
    dragItemId = null;
    endUndo();
    try {
      workspaceEl?.releasePointerCapture(e.pointerId);
    } catch {
      // already released or the pointer was captured by an item handle
    }
  }

  function handleWheel(e: WheelEvent) {
    if (!workspaceEl) return;

    if (!e.ctrlKey && !e.metaKey) {
      ensureCanvasRoom();
      return;
    }

    if (e.deltaY === 0) return;
    e.preventDefault();

    const pageEl = workspaceEl.querySelector<HTMLElement>(".print-page");
    const pageBounds = pageEl?.getBoundingClientRect();
    const anchor = pageBounds && pageBounds.width > 0 && pageBounds.height > 0
      ? {
          x: (e.clientX - pageBounds.left) / pageBounds.width,
          y: (e.clientY - pageBounds.top) / pageBounds.height,
        }
      : null;
    const pointer = { x: e.clientX, y: e.clientY };
    const previousZoom = doc.zoom;

    setZoom(previousZoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    if (doc.zoom === previousZoom || !pageEl || !anchor) return;

    requestAnimationFrame(() => {
      if (!workspaceEl) return;
      const nextBounds = pageEl.getBoundingClientRect();
      workspaceEl.scrollLeft += nextBounds.left + anchor.x * nextBounds.width - pointer.x;
      workspaceEl.scrollTop += nextBounds.top + anchor.y * nextBounds.height - pointer.y;
      ensureCanvasRoom();
    });
  }

  function handleScroll() {
    ensureCanvasRoom();
  }

  function handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (e.code === "Space" && !e.repeat && !e.ctrlKey && !e.metaKey && !target.closest("input, textarea, select, button, a, summary, [contenteditable], [role=dialog]")) {
      spaceHeld = true;
      e.preventDefault();
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.code === "Space") spaceHeld = false;
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
    if (!(e.currentTarget as HTMLElement).contains(relatedTarget)) {
      isFileDragOver = false;
    }
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    isFileDragOver = false;

    const files = e.dataTransfer?.files;
    if (!files) return;

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      showNotice("Drop one or more image files to add them", "info");
      return;
    }
    let failed = 0;
    for (const file of imageFiles) {
      try {
        await addImage(file);
      } catch {
        failed += 1;
      }
    }
    if (failed) showNotice(`${failed} image${failed === 1 ? "" : "s"} could not be loaded`, "error");
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

  const cursorClass = $derived(panning ? "cursor-grabbing" : spaceHeld ? "cursor-grab" : "cursor-default");
</script>

<svelte:window onpointerup={handlePointerUp} onpointercancel={handlePointerUp} onkeydown={handleKeyDown} onkeyup={handleKeyUp} onblur={() => { spaceHeld = false; panning = false; }} />

<div
  class="workspace-bg flex-1 overflow-auto relative {cursorClass}"
  class:panning={panning}
  class:dragging={dragging}
  bind:this={workspaceEl}
  role="application"
  aria-label="Workspace"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onwheel={handleWheel}
  onscroll={handleScroll}
  onauxclick={(e) => e.preventDefault()}
  ondragover={handleDragOver}
  ondragenter={handleDragEnter}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  oncontextmenu={handleContextMenu}
>
  <div class="workspace-stage min-h-full flex items-start justify-center" bind:this={stageEl} style="padding: {paddingCss(canvasPad)}">
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
