// Run with: node src/voice/voiceMode.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveVoiceMode, usesCartesia } from './voiceMode.js';

test('effectiveVoiceMode: returns video.voiceMode if set', () => {
  assert.equal(effectiveVoiceMode({ voiceMode: 'flow' }, { voiceMode: 'voiceover' }), 'flow');
  assert.equal(effectiveVoiceMode({ voiceMode: 'voiceover' }, { voiceMode: 'flow' }), 'voiceover');
});

test('effectiveVoiceMode: falls back to branch.voiceMode when video has no voiceMode or null', () => {
  assert.equal(effectiveVoiceMode({ voiceMode: null }, { voiceMode: 'flow' }), 'flow');
  assert.equal(effectiveVoiceMode({ voiceMode: null }, { voiceMode: 'voiceover' }), 'voiceover');
  assert.equal(effectiveVoiceMode({}, { voiceMode: 'flow' }), 'flow');
  assert.equal(effectiveVoiceMode(null, { voiceMode: 'flow' }), 'flow');
  assert.equal(effectiveVoiceMode(undefined, { voiceMode: 'flow' }), 'flow');
});

test('effectiveVoiceMode: defaults to voiceover when neither video nor branch sets voiceMode', () => {
  assert.equal(effectiveVoiceMode(null, null), 'voiceover');
  assert.equal(effectiveVoiceMode(undefined, undefined), 'voiceover');
  assert.equal(effectiveVoiceMode({}, {}), 'voiceover');
  assert.equal(effectiveVoiceMode({ voiceMode: null }, { voiceMode: null }), 'voiceover');
});

test('usesCartesia: returns false for flow mode and true for voiceover mode', () => {
  assert.equal(usesCartesia({ voiceMode: 'flow' }, null), false);
  assert.equal(usesCartesia({ voiceMode: null }, { voiceMode: 'flow' }), false);
  assert.equal(usesCartesia({ voiceMode: 'voiceover' }, { voiceMode: 'flow' }), true);
  assert.equal(usesCartesia({ voiceMode: null }, { voiceMode: 'voiceover' }), true);
  assert.equal(usesCartesia(null, null), true);
  assert.equal(usesCartesia({}, {}), true);
});
