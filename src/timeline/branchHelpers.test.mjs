import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORIENTATION_LABELS,
  ORIENTATION_DESCRIPTIONS,
  VIDEO_TYPE_LABELS,
  VIDEO_TYPE_HINTS,
  MODE_LABELS,
  getOrientationLabel,
  getVideoTypeLabel,
  getModeLabel,
  groupVideosByBranch,
} from './branchHelpers.js';

test('branch label helpers return correct Spanish labels and fallbacks', () => {
  assert.equal(getOrientationLabel('horizontal'), 'Horizontal');
  assert.equal(getOrientationLabel('vertical'), 'Vertical');
  assert.equal(getOrientationLabel('unknown'), 'Horizontal');

  assert.equal(getVideoTypeLabel('explainer'), 'Explicativo');
  assert.equal(getVideoTypeLabel('story'), 'Historia');
  assert.equal(getVideoTypeLabel('list'), 'Top / lista');
  assert.equal(getVideoTypeLabel('horror'), 'Terror / misterio');
  assert.equal(getVideoTypeLabel('other'), 'Explicativo');

  assert.equal(getModeLabel('free'), 'Libre');
  assert.equal(getModeLabel('series'), 'Serie');
  assert.equal(getModeLabel('titles'), 'Títulos');
  assert.equal(getModeLabel('other'), 'Libre');

  assert.equal(ORIENTATION_DESCRIPTIONS.horizontal, 'Horizontal 16:9 · YouTube');
  assert.equal(ORIENTATION_DESCRIPTIONS.vertical, 'Vertical 9:16 · Shorts, TikTok, Reels');
  assert.ok(VIDEO_TYPE_HINTS.explainer);
  assert.ok(VIDEO_TYPE_HINTS.story);
  assert.ok(VIDEO_TYPE_HINTS.list);
  assert.ok(VIDEO_TYPE_HINTS.horror);
});

test('groupVideosByBranch groups videos under their branch correctly', () => {
  const branches = [
    { id: 'b1', name: 'Branch 1' },
    { id: 'b2', name: 'Branch 2' },
  ];
  const videos = [
    { id: 'v1', branchId: 'b1', title: 'Video 1' },
    { id: 'v2', branchId: 'b2', title: 'Video 2' },
    { id: 'v3', branchId: 'b1', title: 'Video 3' },
  ];

  const grouped = groupVideosByBranch(branches, videos);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].branch.id, 'b1');
  assert.deepEqual(
    grouped[0].videos.map((v) => v.id),
    ['v1', 'v3'],
  );
  assert.equal(grouped[1].branch.id, 'b2');
  assert.deepEqual(
    grouped[1].videos.map((v) => v.id),
    ['v2'],
  );
});

test('groupVideosByBranch handles empty or missing inputs gracefully', () => {
  assert.deepEqual(groupVideosByBranch([], []), []);
  assert.deepEqual(groupVideosByBranch(null, null), []);

  const branches = [{ id: 'b1', name: 'Branch 1' }];
  const grouped = groupVideosByBranch(branches, []);
  assert.equal(grouped.length, 1);
  assert.deepEqual(grouped[0].videos, []);
});

test('groupVideosByBranch assigns orphaned videos to the first branch as safety fallback', () => {
  const branches = [{ id: 'b1', name: 'Branch 1' }];
  const videos = [{ id: 'v-orphan', branchId: 'non-existent', title: 'Orphan' }];

  const grouped = groupVideosByBranch(branches, videos);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].videos.length, 1);
  assert.equal(grouped[0].videos[0].id, 'v-orphan');
});
