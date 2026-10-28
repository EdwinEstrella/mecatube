import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyOrientation } from './orientation.js';

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

test('applyOrientation: horizontal returns text byte-identical', () => {
  assert.equal(applyOrientation(promptOne, 'horizontal'), promptOne);
  assert.equal(applyOrientation(promptTwo, 'horizontal'), promptTwo);
  assert.equal(applyOrientation(promptOne, undefined), promptOne);
  assert.equal(applyOrientation(promptTwo, null), promptTwo);
});

test('applyOrientation: vertical eliminates 16:9 and 1920x1080 from prompt-1 and prompt-2', () => {
  const v1 = applyOrientation(promptOne, 'vertical');
  const v2 = applyOrientation(promptTwo, 'vertical');

  assert.ok(!v1.includes('16:9'), 'prompt-1 vertical contains 16:9');
  assert.ok(!v1.includes('1920x1080'), 'prompt-1 vertical contains 1920x1080');

  assert.ok(!v2.includes('16:9'), 'prompt-2 vertical contains 16:9');
  assert.ok(!v2.includes('1920x1080'), 'prompt-2 vertical contains 1920x1080');

  // Must contain vertical aspect equivalents
  assert.ok(v1.includes('9:16'), 'prompt-1 vertical missing 9:16');
  assert.ok(v2.includes('9:16'), 'prompt-2 vertical missing 9:16');
  assert.ok(v2.includes('1080x1920'), 'prompt-2 vertical missing 1080x1920');
});

test('applyOrientation: vertical preserves structure line counts for ETAPA, Bloque, PLANTILLA', () => {
  const v1 = applyOrientation(promptOne, 'vertical');
  const v2 = applyOrientation(promptTwo, 'vertical');

  assert.equal(
    countStructureLines(v1),
    countStructureLines(promptOne),
    'Structure line count in prompt-1 changed'
  );

  assert.equal(
    countStructureLines(v2),
    countStructureLines(promptTwo),
    'Structure line count in prompt-2 changed'
  );
});

test('applyOrientation: adds vertical note near the top of prompt-1 for vertical', () => {
  const v1 = applyOrientation(promptOne, 'vertical');
  assert.ok(
    v1.includes('YouTube Shorts, TikTok e Instagram Reels'),
    'prompt-1 vertical missing short-form platforms sentence'
  );
  assert.ok(
    v1.includes('gancho en los primeros 2 segundos, ritmo rápido'),
    'prompt-1 vertical missing pacing / hook sentence'
  );
});

test('applyOrientation: vertical prompt-1 asks for platform metadata blocks (Shorts/TikTok/Reels)', () => {
  const v1 = applyOrientation(promptOne, 'vertical');
  assert.ok(v1.includes('YOUTUBE SHORTS'), 'prompt-1 vertical missing YOUTUBE SHORTS block');
  assert.ok(v1.includes('TIKTOK'), 'prompt-1 vertical missing TIKTOK block');
  assert.ok(v1.includes('INSTAGRAM REELS'), 'prompt-1 vertical missing INSTAGRAM REELS block');
  assert.ok(v1.includes('#Shorts'), 'prompt-1 vertical missing #Shorts requirement');
  assert.ok(v1.includes('150'), 'prompt-1 vertical missing 150 chars caption requirement for TikTok');
});

test('applyOrientation: non-string input returns empty string', () => {
  assert.equal(applyOrientation(null, 'vertical'), '');
  assert.equal(applyOrientation(undefined, 'vertical'), '');
  assert.equal(applyOrientation(123, 'vertical'), '');
});
