import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import {
  doc, createNewDocument, addShape, addText, setPageTemplate, setPageSize,
  selectItem, deleteSelectedItem, duplicateSelectedItem, setItemWidth, setItemHeight,
  setItemRotation, updateText, beginUndo, endUndo, moveItemsByDelta, undo, redo,
  undoState, saveProject, openProject, importJson, setZoom, setUnit,
  setProjectName,
  bringToFront, sendToBack, centerSelectedOnPage, setItemX, setItemY, exportJson,
  enterCropMode, enterCutMode, exitCropMode, setCropRelativeToSession, resetCrop,
  applyCutFromSession, cropSession, updateSessionLocalCrop,
} from './documentStore.svelte.ts';
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
    writeBytes: async () => { throw new Error('Quota exceeded'); },
  });
  await saveProject();
  assert.equal(doc.dirty, true);
  assert.equal(ui.notice?.type, 'error');
});

test('invalid JSON import leaves current artwork and history intact', async () => {
  addText(); const before = exportJson();
  await assert.rejects(importJson(new File(['{"page":{}}'], 'bad.json')));
  assert.equal(exportJson(), before); assert.equal(undoState.hasUndo, true);
});

test('JSON round-trip preserves text, rotation, custom paper, and physical dimensions', async () => {
  setPageSize(123, 234); addText();
  updateText(doc.items[0].id, {text: 'Hello <world> & friends\nLine 2'}); setItemRotation(doc.items[0].id, 37);
  const json = exportJson(); createNewDocument('a4-portrait');
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
  const file = new File([exportJson()], 'project.json');
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
