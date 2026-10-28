import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTitlesInput, mapTitleStatus, reorderTitles } from './titleBankHelpers.js';

test('parseTitlesInput trims, dedupes, ignores empty lines, and enforces max 200 chars per title', () => {
  const longText = 'A'.repeat(250);
  const input = `
    Primer título
    Segundo título

    Primer título
    ${longText}
  `;

  const existing = [{ id: '1', text: 'Título existente', videoId: null }];
  const parsed = parseTitlesInput(input, existing);

  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].text, 'Primer título');
  assert.equal(parsed[1].text, 'Segundo título');
  assert.equal(parsed[2].text.length, 200);
  assert.ok(parsed[0].id);
  assert.equal(parsed[0].videoId, null);
});

test('parseTitlesInput dedupes against existing titles case-insensitively', () => {
  const existing = [{ id: '1', text: 'Cómo aprender Node.js', videoId: null }];
  const input = `
    cómo aprender node.js
    Nuevo tema
  `;

  const parsed = parseTitlesInput(input, existing);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].text, 'Nuevo tema');
});

test('parseTitlesInput respects 500 total limit', () => {
  const existing = Array.from({ length: 498 }, (_, i) => ({ id: `e-${i}`, text: `Existente ${i}` }));
  const input = 'Título A\nTítulo B\nTítulo C\nTítulo D';

  const parsed = parseTitlesInput(input, existing);
  assert.equal(parsed.length, 2); // only 2 slots remaining
});

test('mapTitleStatus: returns "Sin video", "En progreso", and "Publicado" correctly', () => {
  // Case 1: no videoId
  assert.deepEqual(mapTitleStatus({ text: 'A', videoId: null }, null, []), {
    status: 'none',
    label: 'Sin video',
  });

  // Case 2: videoId exists, video found, not published
  const video = { id: 'v1', title: 'Video 1' };
  const stagesInProgress = [
    { key: 'idea', status: 'done' },
    { key: 'script', status: 'current' },
    { key: 'published', status: 'pending' },
  ];
  assert.deepEqual(mapTitleStatus({ text: 'A', videoId: 'v1' }, video, stagesInProgress), {
    status: 'in-progress',
    label: 'En progreso',
  });

  // Case 3: published stage is done
  const stagesPublished = [
    { key: 'idea', status: 'done' },
    { key: 'script', status: 'done' },
    { key: 'published', status: 'done' },
  ];
  assert.deepEqual(mapTitleStatus({ text: 'A', videoId: 'v1' }, video, stagesPublished), {
    status: 'published',
    label: 'Publicado',
  });
});

test('reorderTitles moves elements immutably and handles boundaries', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  const movedDown = reorderTitles(items, 0, 1);
  assert.deepEqual(movedDown.map((i) => i.id), ['b', 'a', 'c']);
  assert.deepEqual(items.map((i) => i.id), ['a', 'b', 'c']); // original intact

  const movedUp = reorderTitles(items, 2, 0);
  assert.deepEqual(movedUp.map((i) => i.id), ['c', 'a', 'b']);

  // Invalid indices return shallow copy
  assert.deepEqual(reorderTitles(items, -1, 1).map((i) => i.id), ['a', 'b', 'c']);
  assert.deepEqual(reorderTitles(items, 0, 99).map((i) => i.id), ['a', 'b', 'c']);
});
