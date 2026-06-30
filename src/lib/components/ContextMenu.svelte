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
  } from "../stores/documentStore.svelte.ts";

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
  style="left: {Math.min(x, window.innerWidth - 220)}px; top: {Math.min(y, window.innerHeight - 320)}px"
  role="menu"
  aria-label="Item actions"
>
  <button class="btn btn-sm btn-ghost w-full justify-start" role="menuitem" onclick={() => action(duplicateSelectedItem)}>
    Duplicate
    <kbd class="kbd kbd-xs ml-auto">Ctrl + D</kbd>
  </button>

  <button class="btn btn-sm btn-ghost w-full justify-start" role="menuitem" onclick={() => action(deleteSelectedItem)}>
    Delete
    <kbd class="kbd kbd-xs ml-auto">Del</kbd>
  </button>

  <div class="divider my-1"></div>

  <button class="btn btn-sm btn-ghost w-full justify-start" role="menuitem" onclick={() => action(() => bringToFront(item.id))}>
    Bring to Front
    <kbd class="kbd kbd-xs ml-auto">Ctrl + ]</kbd>
  </button>
  <button class="btn btn-sm btn-ghost w-full justify-start" role="menuitem" onclick={() => action(() => bringForward(item.id))}>
    Bring Forward
  </button>
  <button class="btn btn-sm btn-ghost w-full justify-start" role="menuitem" onclick={() => action(() => sendBackward(item.id))}>
    Send Backward
  </button>
  <button class="btn btn-sm btn-ghost w-full justify-start" role="menuitem" onclick={() => action(() => sendToBack(item.id))}>
    Send to Back
    <kbd class="kbd kbd-xs ml-auto">Ctrl + [</kbd>
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
