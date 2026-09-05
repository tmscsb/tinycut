<script lang="ts">
  import Icon from "./Icon.svelte";
  import { setItemRotation } from "../stores/documentStore.svelte.ts";

  let { id, rotationDeg }: { id: string; rotationDeg: number } = $props();
  let display = $state("");

  $effect(() => {
    display = rotationDeg.toFixed(2);
  });

  function apply() {
    const value = Number.parseFloat(display);
    if (Number.isFinite(value)) setItemRotation(id, value);
  }

  function applyOnEnter(e: KeyboardEvent) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    apply();
    (e.currentTarget as HTMLInputElement).blur();
  }
</script>

<label class="form-control">
  <span class="label text-xs">Rotation (degrees)</span>
  <div class="join w-full">
    <button
      class="join-item btn btn-sm btn-outline"
      type="button"
      title="Rotate left 90 degrees"
      aria-label="Rotate left 90 degrees"
      onclick={() => setItemRotation(id, rotationDeg - 90)}
    >
      <Icon name="undo" />
    </button>
    <input
      class="join-item input input-bordered input-sm min-w-0 flex-1"
      type="number"
      step="0.01"
      aria-label="Rotation in degrees"
      bind:value={display}
      onchange={apply}
      onkeydown={applyOnEnter}
    />
    <button
      class="join-item btn btn-sm btn-outline"
      type="button"
      title="Rotate right 90 degrees"
      aria-label="Rotate right 90 degrees"
      onclick={() => setItemRotation(id, rotationDeg + 90)}
    >
      <Icon name="redo" />
    </button>
  </div>
</label>
