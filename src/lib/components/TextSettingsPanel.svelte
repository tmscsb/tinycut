<script lang="ts">
  import type { TextItem } from "../types/document.ts";
  import {
    doc,
    setItemWidth,
    setItemHeight,
    setItemX,
    setItemY,
    updateText,
    endTextEdit,
  } from "../stores/documentStore.svelte.ts";
  import { displayValue, parseInputToMm, formatDisplay } from "../utils/units.ts";
  import SelectionActions from "./SelectionActions.svelte";
  import RotationControl from "./RotationControl.svelte";

  let { item }: { item: TextItem } = $props();
  let x = $state("");
  let y = $state("");
  let width = $state("");
  let height = $state("");

  $effect(() => {
    x = formatDisplay(item.xMm, doc.unit);
    y = formatDisplay(item.yMm, doc.unit);
    width = formatDisplay(item.widthMm, doc.unit);
    height = formatDisplay(item.heightMm, doc.unit);
  });

  function mm(value: string) {
    return parseInputToMm(Number.parseFloat(value), doc.unit);
  }
</script>

<div class="space-y-5">
  <div class="pb-3 border-b border-base-300">
    <h3 class="font-semibold text-sm">{item.name}</h3>
    <p class="text-xs text-base-content/65">Text properties</p>
  </div>

  <div>
    <label class="label text-xs" for={`text-content-${item.id}`}>Content</label>
    <textarea id={`text-content-${item.id}`} class="textarea textarea-bordered w-full" rows="4" value={item.text} oninput={(e) => updateText(item.id, { text: e.currentTarget.value }, true)} onblur={endTextEdit}></textarea>
  </div>

  <div class="grid grid-cols-2 gap-2">
    <label class="form-control"><span class="label text-xs">X ({doc.unit})</span><input class="input input-bordered input-sm" type="number" bind:value={x} onchange={() => Number.isFinite(mm(x)) && setItemX(item.id, mm(x))} /></label>
    <label class="form-control"><span class="label text-xs">Y ({doc.unit})</span><input class="input input-bordered input-sm" type="number" bind:value={y} onchange={() => Number.isFinite(mm(y)) && setItemY(item.id, mm(y))} /></label>
    <label class="form-control"><span class="label text-xs">Width ({doc.unit})</span><input class="input input-bordered input-sm" type="number" bind:value={width} onchange={() => mm(width) > 0 && setItemWidth(item.id, mm(width))} /></label>
    <label class="form-control"><span class="label text-xs">Height ({doc.unit})</span><input class="input input-bordered input-sm" type="number" bind:value={height} onchange={() => mm(height) > 0 && setItemHeight(item.id, mm(height))} /></label>
  </div>

  <RotationControl id={item.id} rotationDeg={item.rotationDeg} />

  <div class="grid grid-cols-2 gap-2">
    <label class="form-control"><span class="label text-xs">Font size ({doc.unit})</span><input class="input input-bordered input-sm" type="number" min={doc.unit === "cm" ? "0.1" : "1"} step={doc.unit === "cm" ? "0.1" : "0.5"} value={displayValue(item.fontSizeMm, doc.unit)} onchange={(e) => updateText(item.id, { fontSizeMm: Math.max(1, parseInputToMm(Number(e.currentTarget.value), doc.unit)) })} /></label>
    <label class="form-control"><span class="label text-xs">Weight</span><select class="select select-bordered select-sm" value={item.fontWeight} onchange={(e) => updateText(item.id, { fontWeight: e.currentTarget.value as TextItem["fontWeight"] })}><option value="400">Regular</option><option value="600">Semibold</option><option value="700">Bold</option></select></label>
  </div>

  <label class="form-control"><span class="label text-xs">Font</span><select class="select select-bordered select-sm" value={item.fontFamily} onchange={(e) => updateText(item.id, { fontFamily: e.currentTarget.value })}><option value="Arial, sans-serif">Arial</option><option value="Georgia, serif">Georgia</option><option value="'Courier New', monospace">Courier New</option></select></label>

  <div class="flex items-end gap-2">
    <label class="form-control"><span class="label text-xs">Color</span><input class="w-10 h-9 rounded border border-base-300" type="color" value={item.color} onchange={(e) => updateText(item.id, { color: e.currentTarget.value })} /></label>
    <label class="form-control flex-1"><span class="label text-xs">Align</span><select class="select select-bordered select-sm" value={item.textAlign} onchange={(e) => updateText(item.id, { textAlign: e.currentTarget.value as TextItem["textAlign"] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
  </div>

  <SelectionActions />
</div>
