// Pure voice mode helpers. Resolves whether a video uses Cartesia voice-over
// or Flow character speech.
export function effectiveVoiceMode(video, branch) {
  if (video?.voiceMode) {
    return video.voiceMode;
  }
  if (branch?.voiceMode) {
    return branch.voiceMode;
  }
  return 'voiceover';
}

export function usesCartesia(video, branch) {
  return effectiveVoiceMode(video, branch) !== 'flow';
}
