<script lang="ts">
  import { ui, hideShortcuts } from "../stores/uiStore.svelte.ts";
  import { trapTabFocus } from "../utils/focus.ts";

  const shortcuts: { category: string; items: { keys: string[]; label: string }[] }[] = [
    {
      category: "General",
      items: [
        { keys: ["Ctrl", "Z"], label: "Undo" },
        { keys: ["Ctrl", "Shift", "Z"], label: "Redo" },
        { keys: ["Ctrl", "Y"], label: "Redo (alternate)" },
        { keys: ["Del", "Backspace"], label: "Delete selected item" },
        { keys: ["Ctrl", "D"], label: "Duplicate selected item" },
        { keys: ["Ctrl", "S"], label: "Save to browser storage" },
        { keys: ["Ctrl", "N"], label: "New A4 document" },
        { keys: ["Ctrl", "]"], label: "Bring to front" },
        { keys: ["Ctrl", "["], label: "Send to back" },
        { keys: ["Esc"], label: "Deselect / exit crop mode" },
        { keys: ["?"], label: "Show this shortcuts dialog" },
      ],
    },
    {
      category: "Move & Resize",
      items: [
        { keys: ["↑"], label: "Nudge up 1 mm" },
        { keys: ["↓"], label: "Nudge down 1 mm" },
        { keys: ["←"], label: "Nudge left 1 mm" },
        { keys: ["→"], label: "Nudge right 1 mm" },
        { keys: ["Shift", "Arrows"], label: "Nudge 10 mm" },
        { keys: ["Shift", "click"], label: "Add or remove from selection" },
      ],
    },
    {
      category: "Zoom & Pan",
      items: [
        { keys: ["Ctrl", "+"], label: "Zoom in" },
        { keys: ["Ctrl", "-"], label: "Zoom out" },
        { keys: ["Ctrl", "0"], label: "Reset zoom to 100%" },
        { keys: ["Middle-click", "drag"], label: "Pan the workspace" },
      ],
    },
  ];

  const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");
  let dialogEl: HTMLDivElement | undefined = $state();
  let closeButton: HTMLButtonElement | undefined = $state();

  $effect(() => {
    if (!ui.showShortcuts) return;
    requestAnimationFrame(() => closeButton?.focus());
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      hideShortcuts();
      return;
    }
    trapTabFocus(e, dialogEl);
  }
</script>

{#if ui.showShortcuts}
  <div class="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" tabindex="-1" bind:this={dialogEl} onkeydown={handleKeydown}>
    <div class="modal-box max-w-2xl">
      <h3 id="shortcuts-title" class="text-lg font-bold mb-4">Keyboard Shortcuts</h3>

      <div class="space-y-5">
        {#each shortcuts as group}
          <div>
            <h4 class="text-sm font-semibold text-base-content/60 uppercase tracking-wide mb-2">
              {group.category}
            </h4>
            <div class="space-y-1.5">
              {#each group.items as item}
                <div class="flex items-center justify-between py-1">
                  <span class="text-sm text-base-content/80">{item.label}</span>
                  <div class="flex items-center gap-0.5 text-base-content/65">
                    {#each item.keys as key, i}
                      {#if i > 0}<span class="text-xs font-bold">+</span>{/if}
                      {#if key === "Ctrl"}
                        <kbd class="kbd kbd-sm">{isMac ? "⌘" : "Ctrl"}</kbd>
                      {:else if key === "Shift"}
                        <kbd class="kbd kbd-sm">Shift</kbd>
                      {:else}
                        <kbd class="kbd kbd-sm">{key}</kbd>
                      {/if}
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <div class="modal-action">
        <button class="btn btn-primary" bind:this={closeButton} onclick={hideShortcuts}>Got it</button>
      </div>
    </div>
    <button type="button" class="modal-backdrop" aria-label="Close" onclick={hideShortcuts}></button>
  </div>
{/if}
