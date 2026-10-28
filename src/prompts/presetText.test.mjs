import test from 'node:test';
import assert from 'node:assert/strict';
import { extractBranchCharacters, buildPresetText } from './presetText.js';

test('extractBranchCharacters: returns null on null, undefined, or empty branch', () => {
  assert.equal(extractBranchCharacters(null), null);
  assert.equal(extractBranchCharacters(undefined), null);
  assert.equal(extractBranchCharacters({}), null);
  assert.equal(extractBranchCharacters({ characters: [] }), null);
});

test('extractBranchCharacters: returns characters array when present', () => {
  const characters = [
    { key: 'c1', name: 'Ana', description: 'Hero' },
    { key: 'c2', name: 'Bob', description: 'Friend' },
  ];
  assert.deepEqual(extractBranchCharacters({ characters }), characters);
});

test('extractBranchCharacters: maps characterImages when characterMode is own', () => {
  const branch = {
    characterMode: 'own',
    characterImages: ['ref1.png', 'ref2.png'],
  };
  const result = extractBranchCharacters(branch);
  assert.deepEqual(result, [
    {
      key: 'personaje-1',
      name: 'Personaje 1',
      description: '',
      file: 'ref1.png',
      source: 'own',
    },
    {
      key: 'personaje-2',
      name: 'Personaje 2',
      description: '',
      file: 'ref2.png',
      source: 'own',
    },
  ]);
});

test('extractBranchCharacters: ignores characterImages if characterMode is not own', () => {
  const branch = {
    characterMode: 'custom',
    characterImages: ['ref1.png'],
  };
  assert.equal(extractBranchCharacters(branch), null);
});

test('buildPresetText: handles unknown presetId safely', async () => {
  const api = {
    listVideos: async () => [],
    listBranches: async () => [],
    getCurrentWorkspace: async () => ({ style: 'stickman' }),
  };
  const presets = [{ id: 'prompt-1', defaultText: 'Text 1' }];
  const result = await buildPresetText({
    api,
    presetId: 'unknown',
    presets,
    overrides: {},
  });
  assert.equal(result.text, '');
  assert.equal(result.voiceMode, 'voiceover');
});

test('buildPresetText: prompt-1 snapshot voiceMode from branch', async () => {
  const branch = {
    id: 'b1',
    voiceMode: 'flow',
    orientation: 'vertical',
    videoType: 'explainer',
  };
  const video = {
    id: 'v1',
    branchId: 'b1',
    voiceMode: 'voiceover',
    brief: 'A great topic',
  };
  const api = {
    listVideos: async () => [video],
    listBranches: async () => [branch],
    getCurrentWorkspace: async () => ({ style: 'stickman' }),
  };
  const presets = [{ id: 'prompt-1', defaultText: 'Base prompt 1' }];
  const result = await buildPresetText({
    api,
    presetId: 'prompt-1',
    video,
    presets,
    overrides: {},
  });
  assert.equal(result.voiceMode, 'flow');
  assert.ok(result.text.includes('=== CONTEXTO DE ESTE VIDEO ==='));
  assert.ok(result.text.includes('A great topic'));
});

test('buildPresetText: prompt-2 loads script and preserves video voiceMode', async () => {
  const branch = {
    id: 'b1',
    voiceMode: 'flow',
  };
  const video = {
    id: 'v1',
    branchId: 'b1',
    voiceMode: 'voiceover',
    scriptConversationId: 'c1',
  };
  const api = {
    listVideos: async () => [video],
    listBranches: async () => [branch],
    getCurrentWorkspace: async () => ({ style: 'stickman' }),
    getConversation: async (id) => {
      assert.equal(id, 'c1');
      return {
        messages: [
          { role: 'assistant', content: '**Título: Demo**\nFormato: horizontal\nDuración: 1 min\nGANCHO:\nHola\nDESARROLLO:\nMundo' },
        ],
      };
    },
  };
  const presets = [{ id: 'prompt-2', defaultText: 'Base prompt 2' }];
  const result = await buildPresetText({
    api,
    presetId: 'prompt-2',
    video,
    presets,
    overrides: {},
  });
  assert.equal(result.voiceMode, 'voiceover');
  assert.ok(result.text.includes('=== GUION DEL VIDEO ==='));
  assert.ok(result.text.includes('**Título: Demo**'));
});
