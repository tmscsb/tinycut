<script lang="ts">
  import type { DocumentItem } from "../types/document.ts";
  import {
    duplicateSelectedItem,
    deleteSelectedItem,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    enterCropMode,
    resetCrop,
    centerSelectedOnPage,
  } from "../stores/documentStore.svelte.ts";
  import { onMount } from "svelte";

  let {
    item,
    x,
    y,
    onclose,
  }: {
    item: DocumentItem;
    x: number;
    y: number;
    onclose: () => void;
  } = $props();

  function action(fn: () => void) {
    fn();
    onclose();
  }

  const isImage = $derived(item.type === "image");
  const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");
  const modKey = isMac ? "⌘" : "Ctrl";
  const menuX = $derived(Math.max(8, Math.min(x, window.innerWidth - 220)));
  const menuY = $derived(Math.max(8, Math.min(y, window.innerHeight - 380)));
  let menuEl: HTMLDivElement | undefined = $state();

  onMount(() => {
    menuEl?.querySelector<HTMLButtonElement>("button")?.focus();
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      e.stopPropagation();
      onclose();
      return;
    }
    if (!menuEl || !["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const items = Array.from(menuEl.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'));
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "Home"
      ? 0
      : e.key === "End"
        ? items.length - 1
        : e.key === "ArrowDown"
          ? (current + 1) % items.length
          : (current - 1 + items.length) % items.length;
    e.preventDefault();
    items[next]?.focus();
  }
</script>

<button
  type="button"
  class="fixed inset-0 z-[100] cursor-default bg-transparent"
  aria-label="Close context menu"
  onclick={onclose}
  oncontextmenu={(e) => { e.preventDefault(); onclose(); }}
>
</button>

<div
  class="fixed z-[101] bg-base-200 border border-base-300 shadow-xl rounded-box p-1 w-52"
  style="left: {menuX}px; top: {menuY}px"
  role="menu"
  aria-label="Item actions"
  tabindex="-1"
  bind:this={menuEl}
  onkeydown={handleKeydown}
>
  <button class="btn btn-sm btn-ghost w-full justify-start" role="menuitem" onclick={() => action(duplicateSelectedItem)}>
    Duplicate
    <kbd class="kbd kbd-xs ml-auto">{modKey} + D</kbd>
  </button>

  <button class="btn btn-sm btn-ghost w-full justify-start" role="menuitem" onclick={() => action(deleteSelectedItem)}>
    Delete
    <kbd class="kbd kbd-xs ml-auto">Del</kbd>
  </button>

  <div class="divider my-1"></div>

  <button class="btn btn-sm btn-ghost w-full justify-start" role="menuitem" onclick={() => action(() => bringToFront(item.id))}>
    Bring to Front
    <kbd class="kbd kbd-xs ml-auto">{modKey} + ]</kbd>
  </button>
  <button class="btn btn-sm btn-ghost w-full justify-start" role="menuitem" onclick={() => action(() => bringForward(item.id))}>
    Bring Forward
  </button>
  <button class="btn btn-sm btn-ghost w-full justify-start" role="menuitem" onclick={() => action(() => sendBackward(item.id))}>
    Send Backward
  </button>
  <button class="btn btn-sm btn-ghost w-full justify-start" role="menuitem" onclick={() => action(() => sendToBack(item.id))}>
    Send to Back
    <kbd class="kbd kbd-xs ml-auto">{modKey} + [</kbd>
  </button>

  <div class="divider my-1"></div>
  <button class="btn btn-sm btn-ghost w-full justify-start" role="menuitem" onclick={() => action(() => centerSelectedOnPage("both"))}>
    Center on Page
  </button>

  {#if isImage}
    <div class="divider my-1"></div>
    <button class="btn btn-sm btn-ghost w-full justify-start" role="menuitem" onclick={() => action(() => enterCropMode(item.id))}>
      Crop
    </button>
    <button class="btn btn-sm btn-ghost w-full justify-start" role="menuitem" onclick={() => action(() => resetCrop(item.id))}>
      Reset Crop
    </button>
  {/if}
</div>
