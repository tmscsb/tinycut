import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import {
  doc, createNewDocument, addShape, addText, setPageTemplate, setPageSize,
  selectItem, deleteSelectedItem, duplicateSelectedItem, setItemWidth, setItemHeight,
  setItemRotation, updateText, beginUndo, endUndo, moveItemsByDelta, undo, redo,
  undoState, saveToLocalStorage, loadFromLocalStorage, importJson, setZoom, setUnit,
  bringToFront, sendToBack, centerSelectedOnPage, setItemX, setItemY, exportJson,
} from './documentStore.svelte.ts';
import { ui } from './uiStore.svelte.ts';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  setItem: (key: string, value: string) => storage.set(key, value),
  getItem: (key: string) => storage.get(key) ?? null,
} });
beforeEach(() => { createNewDocument('a4-portrait'); storage.clear(); });

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

test('saving, changing, undoing, and reloading track unsaved content accurately', () => {
  addText(); saveToLocalStorage(); assert.equal(doc.dirty, false);
  setZoom(2); setUnit('cm'); assert.equal(doc.dirty, false);
  setItemRotation(doc.items[0].id, 45); assert.equal(doc.dirty, true);
  undo(); assert.equal(doc.dirty, false); redo(); assert.equal(doc.dirty, true);
  assert.equal(loadFromLocalStorage(), true); assert.equal(doc.items[0].rotationDeg, 0);
  assert.equal(doc.dirty, false); assert.equal(undoState.hasUndo, false);
});

test('storage failure keeps unsaved edits and provides recovery feedback', () => {
  addText(); const set = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('Quota exceeded'); };
  try { saveToLocalStorage(); assert.equal(doc.dirty, true); assert.equal(ui.notice?.type, 'error'); }
  finally { localStorage.setItem = set; }
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

test('continuous text typing is one undo step and saving ends the edit group', () => {
  addText(); const id = doc.items[0].id;
  updateText(id, {text:'H'}, true); updateText(id, {text:'He'}, true); updateText(id, {text:'Hello'}, true);
  undo(); assert.equal(doc.items[0].type === 'text' && doc.items[0].text, 'Edit this text');
  redo(); saveToLocalStorage(); updateText(id, {text:'Hello!'}, true); undo();
  assert.equal(doc.items[0].type === 'text' && doc.items[0].text, 'Hello'); assert.equal(doc.dirty, false);
});

test('an edit during asynchronous import is never silently overwritten', async () => {
  const file = new File([exportJson()], 'project.json');
  const importing = importJson(file); addText();
  await assert.rejects(importing, /document changed/);
  assert.equal(doc.items.length, 1);
});
