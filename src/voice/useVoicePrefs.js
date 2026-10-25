import { useEffect, useState } from 'react';
import { DEFAULT_MODEL, DEFAULT_VOICE } from './constants.js';

export const FALLBACK_PREFS = { voiceId: DEFAULT_VOICE.id, voiceName: DEFAULT_VOICE.name, model: DEFAULT_MODEL };

// Last voice and model the user generated with (main process store); null until loaded
export function useVoicePrefs() {
  const [prefs, setPrefs] = useState(null);
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) {
      setPrefs(FALLBACK_PREFS);
      return;
    }
    api.getVoicePrefs().then(setPrefs, () => setPrefs(FALLBACK_PREFS));
  }, []);
  return prefs;
}
