import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { composePrompt } from './compose.js';
import {
  VOICE_MODES,
  DEFAULT_VOICE_MODE,
  applyVoiceMode,
  PROMPT1_LINE4_TARGET,
  PROMPT1_LENGTH_TARGET,
  PROMPT1_FORMAT_TARGET,
  PROMPT1_QC_TARGET,
  PROMPT2_SECTION_F_TARGET,
  PROMPT2_SECTION_H_TARGET,
  PROMPT2_PLANTILLA3_TARGET,
  PROMPT2_ACCION_TARGET,
  STORY_PROMPT1_NARRATION_TARGET,
  STORY_PROMPT1_DIALOGUE_TARGET,
  STORY_PROMPT2_ANIMATION_TARGET,
  LIST_PROMPT1_HOST_TARGET,
  LIST_PROMPT1_DIALOGUE_TARGET,
  LIST_PROMPT2_ANIMATION_TARGET,
  HORROR_PROMPT1_VOICE_TARGET,
  HORROR_PROMPT1_DIALOGUE_TARGET,
  HORROR_PROMPT2_ANIMATION_TARGET,
} from './voiceMode.js';
import { VIDEO_TYPES } from './videoTypes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const promptOnePath = path.resolve(__dirname, 'prompt-1.txt');
const promptTwoPath = path.resolve(__dirname, 'prompt-2.txt');
const promptOne = fs.readFileSync(promptOnePath, 'utf8');
const promptTwo = fs.readFileSync(promptTwoPath, 'utf8');

const ORIENTATIONS = ['horizontal', 'vertical'];

function containsTarget(text, target) {
  if (typeof text !== 'string' || typeof target !== 'string') return false;
  if (text.includes(target)) return true;
  const lf = target.replaceAll('\r\n', '\n');
  if (text.includes(lf)) return true;
  const crlf = target.replaceAll(/(?<!\r)\n/g, '\r\n');
  return text.includes(crlf);
}

test('VOICE_MODES exports and defaults', () => {
  assert.deepEqual(VOICE_MODES, ['voiceover', 'flow']);
  assert.equal(DEFAULT_VOICE_MODE, 'voiceover');
});

test('voiceover mode or invalid mode returns text byte-identical', () => {
  assert.equal(applyVoiceMode(promptOne, { presetId: 'prompt-1', voiceMode: 'voiceover' }), promptOne);
  assert.equal(applyVoiceMode(promptTwo, { presetId: 'prompt-2', voiceMode: 'voiceover' }), promptTwo);
  assert.equal(applyVoiceMode(promptOne, { presetId: 'prompt-1', voiceMode: undefined }), promptOne);
  assert.equal(applyVoiceMode(promptTwo, { presetId: 'prompt-2', voiceMode: 'unknown' }), promptTwo);
  assert.equal(applyVoiceMode(null, { voiceMode: 'flow' }), '');
  assert.equal(applyVoiceMode(undefined, { voiceMode: 'flow' }), '');
});

test('every replacement target exists in the composed text for each videoType × orientation', () => {
  const commonPrompt1Targets = [
    PROMPT1_LINE4_TARGET,
    PROMPT1_LENGTH_TARGET,
    PROMPT1_FORMAT_TARGET,
    PROMPT1_QC_TARGET,
  ];

  const commonPrompt2Targets = [
    PROMPT2_SECTION_F_TARGET,
    PROMPT2_SECTION_H_TARGET,
    PROMPT2_PLANTILLA3_TARGET,
    PROMPT2_ACCION_TARGET,
  ];

  const prompt1TypeTargets = {
    story: [STORY_PROMPT1_NARRATION_TARGET, STORY_PROMPT1_DIALOGUE_TARGET],
    list: [LIST_PROMPT1_HOST_TARGET, LIST_PROMPT1_DIALOGUE_TARGET],
    horror: [HORROR_PROMPT1_VOICE_TARGET, HORROR_PROMPT1_DIALOGUE_TARGET],
  };

  const prompt2TypeTargets = {
    story: [STORY_PROMPT2_ANIMATION_TARGET],
    list: [LIST_PROMPT2_ANIMATION_TARGET],
    horror: [HORROR_PROMPT2_ANIMATION_TARGET],
  };

  for (const videoType of VIDEO_TYPES) {
    for (const orientation of ORIENTATIONS) {
      // Compose Prompt 1 before voiceMode transformation
      const c1 = composePrompt(promptOne, {
        presetId: 'prompt-1',
        videoType,
        orientation,
        voiceMode: 'voiceover',
      });

      for (const target of commonPrompt1Targets) {
        assert.ok(
          containsTarget(c1, target),
          `Prompt 1 (${videoType}, ${orientation}) missing target: ${target.slice(0, 40)}...`
        );
      }

      const p1Custom = prompt1TypeTargets[videoType] || [];
      for (const target of p1Custom) {
        assert.ok(
          containsTarget(c1, target),
          `Prompt 1 ${videoType} (${orientation}) missing type target: ${target.slice(0, 40)}...`
        );
      }

      // Compose Prompt 2 before voiceMode transformation
      const c2 = composePrompt(promptTwo, {
        presetId: 'prompt-2',
        videoType,
        orientation,
        voiceMode: 'voiceover',
      });

      for (const target of commonPrompt2Targets) {
        assert.ok(
          containsTarget(c2, target),
          `Prompt 2 (${videoType}, ${orientation}) missing target: ${target.slice(0, 40)}...`
        );
      }

      const p2Custom = prompt2TypeTargets[videoType] || [];
      for (const target of p2Custom) {
        assert.ok(
          containsTarget(c2, target),
          `Prompt 2 ${videoType} (${orientation}) missing type target: ${target.slice(0, 40)}...`
        );
      }
    }
  }
});

test('flow output contains no "nunca hablan" / "no dialogue" / "no lip-sync" / "sin voces" / "narración en off" leftovers', () => {
  const forbiddenPhrases = [
    'nunca hablan',
    'no dialogue',
    'no lip-sync',
    'sin voces',
    'narración en off',
  ];

  for (const videoType of VIDEO_TYPES) {
    for (const orientation of ORIENTATIONS) {
      const f1 = composePrompt(promptOne, {
        presetId: 'prompt-1',
        videoType,
        orientation,
        voiceMode: 'flow',
      });

      const f2 = composePrompt(promptTwo, {
        presetId: 'prompt-2',
        videoType,
        orientation,
        voiceMode: 'flow',
      });

      const lowerF1 = f1.toLowerCase();
      const lowerF2 = f2.toLowerCase();

      for (const phrase of forbiddenPhrases) {
        assert.ok(
          !lowerF1.includes(phrase),
          `Prompt 1 (${videoType}, ${orientation}) contains forbidden phrase "${phrase}" in flow mode`
        );
        assert.ok(
          !lowerF2.includes(phrase),
          `Prompt 2 (${videoType}, ${orientation}) contains forbidden phrase "${phrase}" in flow mode`
        );
      }

      // Flow mode assertions: verify flow characteristics
      assert.ok(f1.includes('NOMBRE: «línea»'), 'Prompt 1 flow missing dialog format');
      assert.ok(f2.includes('natural lip-sync'), 'Prompt 2 flow missing natural lip-sync');
      assert.ok(f2.includes('says in Spanish:'), 'Prompt 2 flow missing says in Spanish');
    }
  }
});

test('voiceover output equals current output exactly across all presets, videoTypes and orientations', () => {
  for (const videoType of VIDEO_TYPES) {
    for (const orientation of ORIENTATIONS) {
      const defaultP1 = composePrompt(promptOne, {
        presetId: 'prompt-1',
        videoType,
        orientation,
      });
      const explicitVoP1 = composePrompt(promptOne, {
        presetId: 'prompt-1',
        videoType,
        orientation,
        voiceMode: 'voiceover',
      });
      assert.equal(explicitVoP1, defaultP1);

      const defaultP2 = composePrompt(promptTwo, {
        presetId: 'prompt-2',
        videoType,
        orientation,
      });
      const explicitVoP2 = composePrompt(promptTwo, {
        presetId: 'prompt-2',
        videoType,
        orientation,
        voiceMode: 'voiceover',
      });
      assert.equal(explicitVoP2, defaultP2);
    }
  }
});

test('applyVoiceMode: flow removes every silent-character rule for all styles', async () => {
  const { STYLES } = await import('./styles.js');
  const silent = /never speak|no lip-sync|nunca hablan|nunca hablar|jamás hablar|narración en off|sin voces|voz narradora/i;
  for (const { id: style } of STYLES) {
    for (const videoType of VIDEO_TYPES) {
      for (const orientation of ORIENTATIONS) {
        for (const [presetId, raw] of [['prompt-1', promptOne], ['prompt-2', promptTwo]]) {
          const out = composePrompt(raw, { presetId, style, orientation, videoType, voiceMode: 'flow' });
          const match = out.match(silent);
          assert.equal(match, null, `${style}/${videoType}/${orientation}/${presetId} still contains "${match?.[0]}"`);
        }
      }
    }
  }
});
