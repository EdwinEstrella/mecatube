import { DEFAULT_STYLE_ID } from './styles.js';
import { composePrompt } from './compose.js';
import { latestScript } from '../timeline/stageContent.js';

let presetsModule = null;
async function resolvePresetsModule() {
  if (!presetsModule) {
    presetsModule = await import('./presets.js');
  }
  return presetsModule;
}

// Maps branch characters (or branch.characterImages when characterMode is 'own') into the standard list format
export function extractBranchCharacters(branch) {
  if (!branch) return null;
  if (Array.isArray(branch.characters) && branch.characters.length > 0) {
    return branch.characters;
  }
  if (
    branch.characterMode === 'own' &&
    Array.isArray(branch.characterImages) &&
    branch.characterImages.length > 0
  ) {
    return branch.characterImages.map((file, idx) => ({
      key: `personaje-${idx + 1}`,
      name: `Personaje ${idx + 1}`,
      description: '',
      file,
      source: 'own',
    }));
  }
  return null;
}

// Builds the final prompt text and determines the voice mode for a preset (prompt-1 or prompt-2)
export async function buildPresetText({ api, presetId, video, overrides, presets }) {
  let targetVideo = video;
  if (typeof targetVideo === 'string') {
    const vList = (await api?.listVideos?.()) ?? [];
    targetVideo = vList.find((v) => v.id === video) ?? null;
  } else if (!targetVideo && api?.getActiveVideo) {
    targetVideo = (await api.getActiveVideo()) ?? null;
  }

  let branch = null;
  const branches = (await api?.listBranches?.()) ?? [];
  if (targetVideo?.branchId && Array.isArray(branches)) {
    branch = branches.find((b) => b.id === targetVideo.branchId) ?? null;
  }
  if (!branch && api?.getActiveVideo) {
    try {
      const activeVid = await api.getActiveVideo();
      if (activeVid?.branchId && Array.isArray(branches)) {
        branch = branches.find((b) => b.id === activeVid.branchId) ?? null;
      }
    } catch {}
  }

  const ws = await api?.getCurrentWorkspace?.();
  const style = ws?.style || DEFAULT_STYLE_ID;

  let loadedPresets = presets;
  let effectiveTextFn = null;
  let promptOverrides = overrides;

  if (loadedPresets) {
    effectiveTextFn = (preset, ov) => ov?.[preset.id] ?? preset.defaultText;
    if (promptOverrides === undefined) {
      promptOverrides = {};
    }
  } else {
    const mod = await resolvePresetsModule();
    loadedPresets = mod.PRESETS;
    effectiveTextFn = mod.effectiveText;
    if (promptOverrides === undefined) {
      promptOverrides = await mod.loadOverrides();
    }
  }

  const preset = Array.isArray(loadedPresets) ? loadedPresets.find((item) => item.id === presetId) : null;
  const branchVoiceMode = branch?.voiceMode || 'voiceover';
  const selectedVoiceMode = presetId === 'prompt-1' ? branchVoiceMode : (targetVideo?.voiceMode || branchVoiceMode);

  if (!preset) {
    return { text: '', voiceMode: selectedVoiceMode };
  }

  const template = effectiveTextFn(preset, promptOverrides);
  const orientation = branch?.orientation || 'horizontal';
  const videoType = branch?.videoType || 'explainer';
  const branchCharacters = extractBranchCharacters(branch);

  let brief = targetVideo?.brief || null;
  if (!brief && api?.getActiveVideo) {
    try {
      const activeVid = await api.getActiveVideo();
      if (activeVid?.brief) brief = activeVid.brief;
    } catch {}
  }

  let videoScript = null;
  if (presetId === 'prompt-2' && targetVideo?.scriptConversationId) {
    try {
      const conv = await api?.getConversation?.(targetVideo.scriptConversationId);
      if (conv?.messages) {
        videoScript = latestScript(conv.messages);
      }
    } catch {}
  }

  const text = composePrompt(template, {
    presetId: preset.id,
    style,
    orientation,
    videoType,
    branchCharacters,
    brief,
    voiceMode: selectedVoiceMode,
    script: videoScript,
  });

  return { text, voiceMode: selectedVoiceMode };
}
