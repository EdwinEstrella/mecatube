// Run: node --test src/prompts/videoTypes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VIDEO_TYPES,
  DEFAULT_VIDEO_TYPE,
  getVideoType,
  applyVideoType,
} from './videoTypes.js';
import { composePrompt } from './compose.js';
import { STYLES } from './styles.js';
import { deriveStages, countDone } from '../timeline/stages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const promptOnePath = path.resolve(__dirname, 'prompt-1.txt');
const promptTwoPath = path.resolve(__dirname, 'prompt-2.txt');
const promptOne = fs.readFileSync(promptOnePath, 'utf8');
const promptTwo = fs.readFileSync(promptTwoPath, 'utf8');

function countStructureLines(text) {
  const lines = text.split(/\r?\n/);
  return lines.filter((line) =>
    /ETAPA|Bloque|PLANTILLA|\[PLACEHOLDER/.test(line)
  ).length;
}

test('catalog contains all 4 video types with explainer as default', () => {
  assert.deepEqual(VIDEO_TYPES, ['explainer', 'story', 'list', 'horror']);
  assert.equal(DEFAULT_VIDEO_TYPE, 'explainer');
  assert.equal(getVideoType('explainer'), 'explainer');
  assert.equal(getVideoType('story'), 'story');
  assert.equal(getVideoType('list'), 'list');
  assert.equal(getVideoType('horror'), 'horror');
  assert.equal(getVideoType('unknown'), 'explainer');
  assert.equal(getVideoType(null), 'explainer');
  assert.equal(getVideoType(undefined), 'explainer');
});

test('applyVideoType: explainer returns prompt-1 and prompt-2 byte-identical', () => {
  assert.equal(applyVideoType(promptOne, 'prompt-1', 'explainer'), promptOne);
  assert.equal(applyVideoType(promptTwo, 'prompt-2', 'explainer'), promptTwo);
  assert.equal(applyVideoType(promptOne, 'prompt-1', DEFAULT_VIDEO_TYPE), promptOne);
  assert.equal(applyVideoType(promptTwo, 'prompt-2', DEFAULT_VIDEO_TYPE), promptTwo);
});

test('applyVideoType: unknown video type falls back to explainer behavior (byte-identical)', () => {
  assert.equal(applyVideoType(promptOne, 'prompt-1', 'unknown-type'), promptOne);
  assert.equal(applyVideoType(promptTwo, 'prompt-2', 'alien-format'), promptTwo);
  assert.equal(applyVideoType(promptOne, 'prompt-1', null), promptOne);
  assert.equal(applyVideoType(promptTwo, 'prompt-2', undefined), promptTwo);
});

test('applyVideoType: non-string input returns empty string', () => {
  assert.equal(applyVideoType(null, 'prompt-1', 'story'), '');
  assert.equal(applyVideoType(undefined, 'prompt-2', 'list'), '');
  assert.equal(applyVideoType(12345, 'prompt-1', 'horror'), '');
});

test('applyVideoType: for each non-explainer type contains MODO DE VIDEO and keeps structural lines identical', () => {
  const nonExplainerTypes = ['story', 'list', 'horror'];
  const p1BaseStructure = countStructureLines(promptOne);
  const p2BaseStructure = countStructureLines(promptTwo);

  for (const videoType of nonExplainerTypes) {
    const p1Result = applyVideoType(promptOne, 'prompt-1', videoType);
    const p2Result = applyVideoType(promptTwo, 'prompt-2', videoType);

    // 1. Must contain "MODO DE VIDEO"
    assert.ok(
      p1Result.includes('MODO DE VIDEO'),
      `prompt-1 with ${videoType} missing 'MODO DE VIDEO'`
    );
    assert.ok(
      p2Result.includes('MODO DE VIDEO'),
      `prompt-2 with ${videoType} missing 'MODO DE VIDEO'`
    );

    // 2. Count of structural lines must remain identical
    assert.equal(
      countStructureLines(p1Result),
      p1BaseStructure,
      `prompt-1 with ${videoType} changed structural line count`
    );
    assert.equal(
      countStructureLines(p2Result),
      p2BaseStructure,
      `prompt-2 with ${videoType} changed structural line count`
    );
  }
});

test('composePrompt: composition with styles + vertical orientation still keeps structure', () => {
  const styles = STYLES.map((s) => s.id);
  const orientations = ['horizontal', 'vertical'];
  const videoTypes = ['explainer', 'story', 'list', 'horror'];
  const p1BaseStructure = countStructureLines(promptOne);
  const p2BaseStructure = countStructureLines(promptTwo);

  for (const videoType of videoTypes) {
    for (const orientation of orientations) {
      // Test prompt-1
      const c1 = composePrompt(promptOne, {
        presetId: 'prompt-1',
        orientation,
        videoType,
      });
      assert.equal(
        countStructureLines(c1),
        p1BaseStructure,
        `prompt-1 composition changed structure with ${orientation} + ${videoType}`
      );

      // Test prompt-2 across all visual styles
      for (const style of styles) {
        const c2 = composePrompt(promptTwo, {
          presetId: 'prompt-2',
          style,
          orientation,
          videoType,
        });
        assert.equal(
          countStructureLines(c2),
          p2BaseStructure,
          `prompt-2 composition changed structure with style ${style} + ${orientation} + ${videoType}`
        );
      }
    }
  }
});

test('stages skip: list branches mark characters stage not-needed', () => {
  const video = (overrides = {}) => ({ id: 'v1', branchId: 'b-list', overrides });

  // 1. For list videoType, characters is not-needed
  const listStages = deriveStages(video(), null, null, { videoType: 'list' });
  const listCharacters = listStages.find((s) => s.key === 'characters');
  assert.equal(listCharacters.status, 'not-needed');
  assert.equal(listCharacters.notNeeded, true);

  // 2. Stages countDone counts not-needed as completed/satisfied
  assert.equal(countDone(listStages), 1); // characters is not-needed -> counted

  // 3. For list branch, when idea/script/metadata/voice are done, characters is skipped and images is current
  const allPreDone = {
    idea: true,
    script: true,
    metadata: true,
    voice: true,
  };
  const advancedListStages = deriveStages(video(allPreDone), null, null, { videoType: 'list' });
  const advancedCharacters = advancedListStages.find((s) => s.key === 'characters');
  const advancedImages = advancedListStages.find((s) => s.key === 'images');

  assert.equal(advancedCharacters.status, 'not-needed');
  assert.equal(advancedImages.status, 'current');

  // 4. Manual override true forces characters done even on list branch
  const overriddenDone = deriveStages(video({ characters: true }), null, null, { videoType: 'list' });
  assert.equal(overriddenDone.find((s) => s.key === 'characters').status, 'done');
  assert.equal(overriddenDone.find((s) => s.key === 'characters').overridden, true);

  // 5. Explainer, story, and horror branches keep characters stage auto/pending
  for (const type of ['explainer', 'story', 'horror']) {
    const stages = deriveStages(video(), null, null, { videoType: type });
    const characters = stages.find((s) => s.key === 'characters');
    assert.equal(characters.notNeeded, false);
    assert.notEqual(characters.status, 'not-needed');
  }
});
