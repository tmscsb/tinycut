import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import {
  doc, createNewDocument, addShape, addText, setPageTemplate, setPageSize,
  selectItem, deleteSelectedItem, duplicateSelectedItem, setItemWidth, setItemHeight,
  setItemRotation, updateText, beginUndo, endUndo, moveItemsByDelta, undo, redo,
  undoState, saveProject, openProject, importJson, setZoom, setUnit,
  setProjectName,
  bringToFront, sendToBack, centerSelectedOnPage, setItemX, setItemY, exportBackup,
  enterCropMode, enterCutMode, exitCropMode, setCropRelativeToSession, resetCrop,
  applyCutFromSession, cropSession, updateSessionLocalCrop,
  copySelection, cutSelection, pasteItems, selectAll, setSelection, setSelectionSize, matchSelectionSize,
  duplicateLayout, setAutosave, saveStatus, getSessionLocalCrop,
} from './documentStore.svelte.ts';
import { listStoredProjects, readStoredProject } from '../utils/projectStorage.ts';
import { parseClipboardPayload } from '../utils/clipboard.ts';
import type { ImageItem } from '../types/document.ts';
import { ui } from './uiStore.svelte.ts';
import { createMemoryBackend, setProjectBackend } from '../utils/projectStorage.ts';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  setItem: (key: string, value: string) => storage.set(key, value),
  getItem: (key: string) => storage.get(key) ?? null,
  removeItem: (key: string) => storage.delete(key),
} });
beforeEach(() => {
  setProjectBackend(createMemoryBackend());
  createNewDocument('a4-portrait');
  storage.clear();
});

test('a new document gets a fresh id and does not load a previously saved layout', async () => {
  addText();
  const firstId = doc.id;
  await saveProject();
  createNewDocument('a4-portrait');
  assert.notEqual(doc.id, firstId);
  assert.equal(doc.items.length, 0);
  assert.equal(doc.dirty, false);
  assert.equal(await openProject(firstId), true);
  assert.equal(doc.items.length, 1);
});

test('opening a saved layout restores its name and artwork', async () => {
  addText();
  setProjectName('Felt board');
  const id = doc.id;
  await saveProject();
  createNewDocument('a4-portrait');
  assert.equal(doc.name, 'Untitled');
  assert.equal(await openProject(id), true);
  assert.equal(doc.id, id);
  assert.equal(doc.name, 'Felt board');
  assert.equal(doc.items.length, 1);
});

test('changing paper preserves artwork, and undo restores the original page', () => {
  addShape('rect'); const id = doc.items[0].id;
  setPageTemplate('a5-landscape');
  assert.equal(doc.items[0].id, id); assert.equal(doc.page.heightMm, 148);
  undo(); assert.equal(doc.page.templateId, 'a4-portrait'); assert.equal(doc.items.length, 1);
  redo(); assert.equal(doc.page.templateId, 'a5-landscape');
});

test('group gestures produce one undo step and keep internal offsets', () => {
  addShape('rect'); const first = doc.items[0].id;
  addText(); const second = doc.items[1].id;
  selectItem(first, true);
  const starts = Object.fromEntries(doc.items.map(item => [item.id, {xMm: item.xMm, yMm: item.yMm}]));
  beginUndo(); moveItemsByDelta([first, second], 5, 8, starts); moveItemsByDelta([first, second], 20, 30, starts); endUndo();
  assert.equal(doc.items[0].xMm, starts[first].xMm + 20);
  assert.equal(doc.items[1].yMm, starts[second].yMm + 30);
  undo(); assert.equal(doc.items[0].xMm, starts[first].xMm); assert.equal(doc.items[1].yMm, starts[second].yMm);
  redo(); assert.equal(doc.items[0].xMm, starts[first].xMm + 20);
});

test('clicking without moving does not create undo history', () => {
  addShape('rect'); beginUndo(); endUndo(); undo();
  assert.equal(doc.items.length, 0); assert.equal(undoState.hasUndo, false);
});

test('multi-selection duplicates and deletes the selected items only', () => {
  addShape('rect'); addShape('ellipse'); addText(); selectItem(doc.items[0].id, true);
  duplicateSelectedItem(); assert.equal(doc.items.length, 5); assert.equal(doc.selectedItemIds.length, 2);
  assert.equal(new Set(doc.items.map(item => item.id)).size, 5);
  deleteSelectedItem(); assert.equal(doc.items.length, 3);
  undo(); assert.equal(doc.items.length, 5); assert.equal(doc.selectedItemIds.length, 2);
});

test('locked numeric dimensions preserve proportions at the minimum size', () => {
  addShape('ellipse'); const item = doc.items[0];
  item.widthMm = 100; item.heightMm = 10;
  setItemWidth(item.id, 1); assert.equal(item.widthMm / item.heightMm, 10); assert.equal(item.heightMm, 1);
  item.widthMm = 10; item.heightMm = 100;
  setItemHeight(item.id, 1); assert.equal(item.widthMm / item.heightMm, 0.1); assert.equal(item.widthMm, 1);
});

test('layer order and centering survive undo and redo', () => {
  addShape('rect'); const first = doc.items[0].id; addText();
  bringToFront(first); assert.equal(doc.items.at(-1)?.id, first);
  sendToBack(first); assert.equal(doc.items[0].id, first);
  selectItem(first); setItemX(first, -10); setItemY(first, -20);
  centerSelectedOnPage('both'); assert.equal(doc.items[0].xMm, 65); assert.equal(doc.items[0].yMm, 118.5);
  undo(); assert.equal(doc.items[0].xMm, -10); redo(); assert.equal(doc.items[0].yMm, 118.5);
});

test('saving, changing, undoing, and reloading track unsaved content accurately', async () => {
  addText(); await saveProject(); assert.equal(doc.dirty, false);
  setZoom(2); setUnit('cm'); assert.equal(doc.dirty, false);
  setItemRotation(doc.items[0].id, 45); assert.equal(doc.dirty, true);
  undo(); assert.equal(doc.dirty, false); redo(); assert.equal(doc.dirty, true);
  assert.equal(await openProject(doc.id), true); assert.equal(doc.items[0].rotationDeg, 0);
  assert.equal(doc.dirty, false); assert.equal(undoState.hasUndo, false);
});

test('storage failure keeps unsaved edits and provides recovery feedback', async () => {
  addText();
  setProjectBackend({
    ...createMemoryBackend(),
    writeFile: async () => { throw new Error('Quota exceeded'); },
  });
  await saveProject();
  assert.equal(doc.dirty, true);
  assert.equal(ui.notice?.type, 'error');
  assert.equal(saveStatus(), 'failed');
});

test('invalid JSON import leaves current artwork and history intact', async () => {
  addText(); const before = await exportBackup();
  await assert.rejects(importJson(new File(['{"page":{}}'], 'bad.json')));
  assert.equal(await exportBackup(), before); assert.equal(undoState.hasUndo, true);
});

test('JSON round-trip preserves text, rotation, custom paper, and physical dimensions', async () => {
  setPageSize(123, 234); addText();
  updateText(doc.items[0].id, {text: 'Hello <world> & friends\nLine 2'}); setItemRotation(doc.items[0].id, 37);
  const json = await exportBackup(); createNewDocument('a4-portrait');
  await importJson(new File([json], 'project.json'));
  assert.equal(doc.page.widthMm, 123); assert.equal(doc.items[0].rotationDeg, 37);
  assert.equal(doc.items[0].type === 'text' && doc.items[0].text, 'Hello <world> & friends\nLine 2');
  assert.equal(doc.dirty, false);
});

test('continuous text typing is one undo step and saving ends the edit group', async () => {
  addText(); const id = doc.items[0].id;
  updateText(id, {text:'H'}, true); updateText(id, {text:'He'}, true); updateText(id, {text:'Hello'}, true);
  undo(); assert.equal(doc.items[0].type === 'text' && doc.items[0].text, 'Edit this text');
  redo(); await saveProject(); updateText(id, {text:'Hello!'}, true); undo();
  assert.equal(doc.items[0].type === 'text' && doc.items[0].text, 'Hello'); assert.equal(doc.dirty, false);
});

test('an edit during asynchronous import is never silently overwritten', async () => {
  const file = new File([await exportBackup()], 'project.json');
  const importing = importJson(file); addText();
  await assert.rejects(importing, /document changed/);
  assert.equal(doc.items.length, 1);
});

test('repeated crops use the visible image and shrink the print frame', async () => {
  const image = { id: 'image', type: 'image', name: 'Sample', src: 'data:image/png;base64,AA==',
    xMm: 20, yMm: 30, widthMm: 100, heightMm: 50, naturalWidthPx: 1000,
    naturalHeightPx: 500, rotationDeg: 0, lockedAspectRatio: true,
    crop: { left: 0, top: 0, right: 1, bottom: 1 } };
  await importJson(new File([JSON.stringify({ version: 2, page: doc.page, items: [image] })], 'crop.json'));
  enterCropMode('image');
  setCropRelativeToSession('image', { left: 0.2, top: 0, right: 1, bottom: 1 });
  exitCropMode();
  assert.deepEqual((doc.items[0] as typeof image).crop, { left: 0.2, top: 0, right: 1, bottom: 1 });
  assert.equal(doc.items[0].widthMm, 80);
  assert.equal(doc.items[0].heightMm, 50);
  assert.equal(doc.items[0].xMm, 40);
  enterCropMode('image');
  setCropRelativeToSession('image', { left: 0.25, top: 0, right: 1, bottom: 1 });
  assert.deepEqual((doc.items[0] as typeof image).crop, { left: 0.4, top: 0, right: 1, bottom: 1 });
  assert.equal(doc.items[0].widthMm, 60);
  assert.equal(doc.items[0].heightMm, 50);
  assert.equal(doc.items[0].xMm, 60);
  resetCrop('image');
  assert.deepEqual((doc.items[0] as typeof image).crop, { left: 0, top: 0, right: 1, bottom: 1 });
  assert.equal(doc.items[0].widthMm, 100);
  assert.equal(doc.items[0].heightMm, 50);
  assert.equal(doc.items[0].xMm, 20);
});

test('cropping an enlarged image trims millimetres and can change aspect ratio', async () => {
  const image = { id: 'image', type: 'image', name: 'Sample', src: 'data:image/png;base64,AA==',
    xMm: 0, yMm: 0, widthMm: 80, heightMm: 40, naturalWidthPx: 800,
    naturalHeightPx: 400, rotationDeg: 0, lockedAspectRatio: true,
    crop: { left: 0, top: 0, right: 1, bottom: 1 } };
  await importJson(new File([JSON.stringify({ version: 2, page: doc.page, items: [image] })], 'crop.json'));
  setItemWidth('image', 160);
  assert.equal(doc.items[0].widthMm, 160);
  assert.equal(doc.items[0].heightMm, 80);
  enterCropMode('image');
  setCropRelativeToSession('image', { left: 0, top: 0, right: 0.5, bottom: 1 });
  exitCropMode();
  assert.equal(doc.items[0].widthMm, 80);
  assert.equal(doc.items[0].heightMm, 80);
  resetCrop('image');
  assert.equal(doc.items[0].widthMm, 160);
  assert.equal(doc.items[0].heightMm, 80);
});

test('cut copies a region as a new image and keeps the original', async () => {
  const image = { id: 'image', type: 'image', name: 'Sample', src: 'data:image/png;base64,AA==',
    xMm: 20, yMm: 30, widthMm: 100, heightMm: 50, naturalWidthPx: 1000,
    naturalHeightPx: 500, rotationDeg: 0, lockedAspectRatio: true,
    crop: { left: 0, top: 0, right: 1, bottom: 1 } };
  await importJson(new File([JSON.stringify({ version: 2, page: doc.page, items: [image] })], 'cut.json'));
  enterCutMode('image');
  updateSessionLocalCrop('image', { left: 0.2, top: 0, right: 1, bottom: 1 });
  assert.equal(doc.items.length, 1);
  assert.equal(doc.items[0].widthMm, 100);
  assert.equal(cropSession.mode, 'cut');
  applyCutFromSession('image');
  assert.equal(doc.items.length, 2);
  assert.equal(doc.items[0].id, 'image');
  assert.equal(doc.items[0].widthMm, 100);
  assert.deepEqual((doc.items[0] as typeof image).crop, { left: 0, top: 0, right: 1, bottom: 1 });
  const cut = doc.items[1] as typeof image;
  assert.equal(cut.widthMm, 80);
  assert.equal(cut.heightMm, 50);
  assert.equal(cut.xMm, 50);
  assert.equal(cut.yMm, 40);
  assert.deepEqual(cut.crop, { left: 0.2, top: 0, right: 1, bottom: 1 });
  assert.equal(cut.name, 'Sample cut');
  assert.equal(doc.selectedItemId, 'image');
  assert.equal(doc.cropModeItemId, 'image');
  assert.equal(cropSession.mode, 'cut');
  applyCutFromSession('image', { left: 0, top: 0.2, right: 0.4, bottom: 0.8 });
  assert.equal(doc.items.length, 3);
  assert.equal(doc.items[0].widthMm, 100);
  const second = doc.items[2] as typeof image;
  assert.equal(second.widthMm, 40);
  assert.ok(Math.abs(second.heightMm - 30) < 1e-12);
  undo();
  assert.equal(doc.items.length, 2);
  undo();
  assert.equal(doc.items.length, 1);
  assert.equal(doc.items[0].widthMm, 100);
});

test('leaving cut mode without applying does not change the original', async () => {
  const image = { id: 'image', type: 'image', name: 'Sample', src: 'data:image/png;base64,AA==',
    xMm: 20, yMm: 30, widthMm: 100, heightMm: 50, naturalWidthPx: 1000,
    naturalHeightPx: 500, rotationDeg: 0, lockedAspectRatio: true,
    crop: { left: 0, top: 0, right: 1, bottom: 1 } };
  await importJson(new File([JSON.stringify({ version: 2, page: doc.page, items: [image] })], 'cut.json'));
  enterCutMode('image');
  updateSessionLocalCrop('image', { left: 0.5, top: 0.5, right: 1, bottom: 1 });
  exitCropMode();
  assert.equal(doc.items.length, 1);
  assert.equal(doc.items[0].widthMm, 100);
  assert.deepEqual((doc.items[0] as typeof image).crop, { left: 0, top: 0, right: 1, bottom: 1 });
  assert.equal(doc.cropModeItemId, null);
});

test('cut from a cropped image uses the visible region', async () => {
  const image = { id: 'image', type: 'image', name: 'Sample', src: 'data:image/png;base64,AA==',
    xMm: 20, yMm: 30, widthMm: 100, heightMm: 50, naturalWidthPx: 1000,
    naturalHeightPx: 500, rotationDeg: 0, lockedAspectRatio: true,
    crop: { left: 0, top: 0, right: 1, bottom: 1 } };
  await importJson(new File([JSON.stringify({ version: 2, page: doc.page, items: [image] })], 'cut.json'));
  enterCropMode('image');
  setCropRelativeToSession('image', { left: 0.2, top: 0, right: 1, bottom: 1 });
  exitCropMode();
  assert.equal(doc.items[0].widthMm, 80);
  enterCutMode('image');
  applyCutFromSession('image', { left: 0.25, top: 0, right: 1, bottom: 1 });
  assert.equal(doc.items.length, 2);
  assert.equal(doc.items[0].widthMm, 80);
  assert.deepEqual((doc.items[0] as typeof image).crop, { left: 0.2, top: 0, right: 1, bottom: 1 });
  const cut = doc.items[1] as typeof image;
  assert.equal(cut.widthMm, 60);
  assert.equal(cut.xMm, 70);
  assert.deepEqual(cut.crop, { left: 0.4, top: 0, right: 1, bottom: 1 });
});

const sampleImage = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, type: 'image', name: 'Sample', src: 'data:image/png;base64,AA==',
  xMm: 20, yMm: 30, widthMm: 100, heightMm: 50, naturalWidthPx: 1000,
  naturalHeightPx: 500, rotationDeg: 0, lockedAspectRatio: true,
  crop: { left: 0, top: 0, right: 1, bottom: 1 }, ...overrides,
});

async function importItems(items: unknown[]) {
  await importJson(new File([JSON.stringify({ version: 2, page: doc.page, items })], 'items.json'));
}

test('a backup embeds each image so it opens in any browser, and importing restores it', async () => {
  await importItems([sampleImage('image')]);
  const backup = JSON.parse(await exportBackup());
  assert.equal(backup.items[0].src, 'data:image/png;base64,AA==');
  assert.equal(backup.items[0].assetId, undefined);
  const assetId = (doc.items[0] as ImageItem).assetId;
  createNewDocument('a4-portrait');
  await importJson(new File([JSON.stringify(backup)], 'backup.json'));
  assert.equal((doc.items[0] as ImageItem).assetId, assetId);
});

test('a cut starts with nothing marked and clears the mark after each piece', async () => {
  await importItems([sampleImage('image')]);
  enterCutMode('image');
  assert.equal(getSessionLocalCrop(doc.items[0] as ImageItem), null);
  assert.equal(applyCutFromSession('image'), false);
  assert.equal(doc.items.length, 1);
  updateSessionLocalCrop('image', { left: 0.1, top: 0.1, right: 0.4, bottom: 0.5 });
  assert.equal(applyCutFromSession('image'), true);
  assert.equal(doc.items.length, 2);
  assert.ok(Math.abs(doc.items[1].widthMm - 30) < 1e-9);
  assert.ok(Math.abs(doc.items[1].heightMm - 20) < 1e-9);
  assert.equal(getSessionLocalCrop(doc.items[0] as ImageItem), null);
  assert.equal(cropSession.mode, 'cut');
});

test('copy and paste make new items beside the originals in one undo step', () => {
  addShape('rect'); addText();
  selectAll();
  assert.equal(doc.selectedItemIds.length, 2);
  const copied = copySelection();
  assert.equal(copied?.items.length, 2);
  return pasteItems().then((pasted) => {
    assert.equal(pasted, true);
    assert.equal(doc.items.length, 4);
    assert.equal(new Set(doc.items.map((item) => item.id)).size, 4);
    assert.deepEqual(doc.selectedItemIds, [doc.items[2].id, doc.items[3].id]);
    assert.equal(doc.items[2].xMm, doc.items[0].xMm + 10);
    assert.equal(doc.items[3].yMm, doc.items[1].yMm + 10);
    undo();
    assert.equal(doc.items.length, 2);
  });
});

test('items copied in one layout paste in place into another, images included', async () => {
  await importItems([sampleImage('image', { xMm: 33, yMm: 44 })]);
  setSelection(['image']);
  const payload = parseClipboardPayload(JSON.stringify(copySelection()));
  assert.ok(payload);
  assert.equal(payload.assets.length, 1);
  assert.doesNotMatch(JSON.stringify(payload), /base64/);
  createNewDocument('a4-portrait');
  assert.equal(await pasteItems(payload), true);
  assert.equal(doc.items.length, 1);
  assert.equal(doc.items[0].xMm, 33);
  assert.equal((doc.items[0] as ImageItem).assetId, payload.assets[0].id);
});

test('cut removes the selection and paste brings it back', async () => {
  addShape('ellipse'); const original = doc.items[0];
  cutSelection();
  assert.equal(doc.items.length, 0);
  await pasteItems();
  assert.equal(doc.items.length, 1);
  assert.equal(doc.items[0].xMm, original.xMm);
  assert.notEqual(doc.items[0].id, original.id);
});

test('one height for a whole selection keeps locked proportions, as one undo step', async () => {
  await importItems([
    sampleImage('wide', { widthMm: 100, heightMm: 50 }),
    sampleImage('tall', { widthMm: 30, heightMm: 60 }),
    sampleImage('free', { widthMm: 40, heightMm: 40, lockedAspectRatio: false }),
  ]);
  selectAll();
  setSelectionSize('height', 80);
  assert.deepEqual(doc.items.map((item) => [item.widthMm, item.heightMm]), [[160, 80], [40, 80], [40, 80]]);
  undo();
  assert.deepEqual(doc.items.map((item) => item.heightMm), [50, 60, 40]);
  setSelection(['wide', 'free', 'tall']);
  matchSelectionSize('width');
  assert.deepEqual(doc.items.map((item) => item.widthMm), [30, 30, 30]);
  assert.deepEqual(doc.items.map((item) => item.heightMm), [15, 60, 40]);
});

test('autosave writes a layout shortly after a change, but never an untouched empty tab', async () => {
  setAutosave(true);
  try {
    setZoom(2);
    await new Promise((resolve) => setTimeout(resolve, 900));
    assert.deepEqual(await listStoredProjects(), []);
    assert.equal(saveStatus(), 'new');
    addText();
    assert.equal(saveStatus(), 'saving');
    await new Promise((resolve) => setTimeout(resolve, 900));
    const saved = await listStoredProjects();
    assert.deepEqual(saved.map((project) => project.id), [doc.id]);
    assert.equal(saveStatus(), 'saved');
    assert.equal(doc.dirty, false);
  } finally {
    setAutosave(false);
  }
});

test('making a copy leaves the original untouched, and undo cannot move the copy back', async () => {
  addText(); setProjectName('Original'); await saveProject();
  const originalId = doc.id;
  setAutosave(true);
  try {
    await duplicateLayout();
    assert.notEqual(doc.id, originalId);
    assert.equal(doc.name, 'Original copy');
    setItemX(doc.items[0].id, 99);
    undo(); undo(); undo();
    assert.notEqual(doc.id, originalId);
    await saveProject();
  } finally {
    setAutosave(false);
  }
  const original = await readStoredProject(originalId);
  assert.equal(original.document.name, 'Original');
  assert.notEqual(original.document.items[0].xMm, 99);
  assert.equal((await listStoredProjects()).length, 2);
});

function slowBackend() {
  const inner = createMemoryBackend();
  let delayMs = 0;
  const pause = () => delayMs ? new Promise((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve();
  return {
    // Image files and all writes are slow; layout JSON reads stay fast, so a switch can land mid-save.
    backend: {
      ...inner,
      readFile: async (path: string) => { if (path.startsWith('assets/')) await pause(); return inner.readFile(path); },
      writeFile: async (path: string, data: Blob) => { await pause(); return inner.writeFile(path, data); },
    },
    slow(ms: number) { delayMs = ms; },
  };
}

test('a save still running when another layout opens writes to its own layout', async () => {
  const storage = slowBackend(); setProjectBackend(storage.backend);
  addText(); setProjectName('Layout B'); await saveProject(); const b = doc.id;
  createNewDocument('a4-portrait');
  await importItems([sampleImage('image')]); setProjectName('Layout A'); await saveProject(); const a = doc.id;
  setItemX(doc.items[0].id, 77);
  storage.slow(30);
  const saving = saveProject({ quiet: true });
  const opening = openProject(b, false);
  await Promise.all([saving, opening]);
  assert.equal(doc.id, b);
  assert.equal((await readStoredProject(b)).document.name, 'Layout B');
  const storedA = await readStoredProject(a);
  assert.equal(storedA.document.name, 'Layout A');
  assert.equal(storedA.document.items[0].xMm, 77);
});

test('an edit made while an imported backup is saving stays marked unsaved', async () => {
  const storage = slowBackend(); setProjectBackend(storage.backend);
  storage.slow(30);
  const importing = importJson(new File([JSON.stringify({ version: 2, page: doc.page, items: [sampleImage('image')] })], 'backup.json'));
  await new Promise((resolve) => setTimeout(resolve, 10));
  addText();
  await importing;
  const stored = await readStoredProject(doc.id);
  assert.ok(doc.dirty || stored.document.items.length === doc.items.length, 'the edit is saved or still flagged');
  assert.equal(doc.items.length, 2);
});

test('a layout with a missing image still saves and backs up the rest', async () => {
  const backend = createMemoryBackend(); setProjectBackend(backend);
  const missing = 'd'.repeat(64);
  await backend.writeFile('projects/missing-image-1/project.json', new Blob([JSON.stringify({
    storage: 2, name: 'Has a gap', assets: { [missing]: { mime: 'image/png', size: 4 } },
    document: { version: 2, page: doc.page, items: [{ ...sampleImage('gone'), src: undefined, assetId: missing }] },
  })]));
  assert.equal(await openProject('missing-image-1', false), true);
  addText();
  assert.equal(await saveProject(), true);
  assert.equal((await readStoredProject('missing-image-1')).document.items.length, 2);
  const backup = JSON.parse(await exportBackup());
  assert.deepEqual(backup.items.map((item: { type: string }) => item.type), ['text']);
});

test('autosave pauses do not split one typing session into several undo steps', async () => {
  addText(); const id = doc.items[0].id;
  updateText(id, { text: 'Hel' }, true);
  await saveProject({ quiet: true });
  updateText(id, { text: 'Hello' }, true);
  undo();
  assert.equal(doc.items[0].type === 'text' && doc.items[0].text, 'Edit this text');
});
