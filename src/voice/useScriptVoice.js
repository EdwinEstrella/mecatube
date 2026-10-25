import { useCallback, useEffect, useRef, useState } from 'react';
import { cleanIpcError } from './constants.js';
import { extractNarration } from './narration.js';
import { ensureScriptVideo } from './scriptVideo.js';
import { FALLBACK_PREFS, useVoicePrefs } from './useVoicePrefs.js';
import { useCreditSummary } from './useCreditSummary.js';

// Container logic for the "Generar voz en off" buttons of a script chat. All script messages share
// one track: the video linked to the conversation.
export function useScriptVoice(conversationId, messages) {
  const prefs = useVoicePrefs() ?? FALLBACK_PREFS;
  const balance = useCreditSummary();
  const [configured, setConfigured] = useState(null);
  const [busy, setBusy] = useState(false);
  const [videoId, setVideoId] = useState(null);
  const [track, setTrack] = useState(null);
  // { messageId, kind: 'confirm' | 'generating' }
  const [phase, setPhase] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);
  const [doneId, setDoneId] = useState(null);
  const videoIdRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const loadTrack = useCallback(async () => {
    const api = window.electronAPI;
    if (!api || !conversationId) {
      videoIdRef.current = null;
      setVideoId(null);
      setTrack(null);
      return;
    }
    const videos = (await api.listVideos()) ?? [];
    const linked = videos.find((video) => video.scriptConversationId === conversationId);
    videoIdRef.current = linked?.id ?? null;
    setVideoId(linked?.id ?? null);
    setTrack(linked ? ((await api.getVoice(linked.id)) ?? null) : null);
  }, [conversationId]);

  useEffect(() => {
    setPhase(null);
    setError(null);
    setDoneId(null);
    loadTrack().catch(() => {});
  }, [loadTrack]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return undefined;
    api.getCartesiaStatus().then((status) => setConfigured(status.configured), () => setConfigured(false));
    api.getVoiceBusy().then(setBusy, () => {});
    const offProgress = api.onVoiceProgress((progress) => {
      if (progress.videoId && progress.videoId === videoIdRef.current) setSeconds(progress.seconds);
    });
    const offFinished = api.onVoiceFinished(() => {
      setBusy(false);
      loadTrack().catch(() => {});
    });
    return () => {
      offProgress();
      offFinished();
    };
  }, [loadTrack]);

  const request = (messageId) => {
    setError(null);
    setPhase({ messageId, kind: 'confirm' });
  };

  const confirm = async (message) => {
    const api = window.electronAPI;
    const text = extractNarration(message.content);
    setError(null);
    if (!text.trim()) {
      setPhase(null);
      setError({ messageId: message.id, text: 'Este mensaje no tiene texto para narrar.' });
      return;
    }
    setSeconds(0);
    setBusy(true);
    setPhase({ messageId: message.id, kind: 'generating' });
    try {
      const video = await ensureScriptVideo(api, conversationId, messagesRef.current);
      videoIdRef.current = video.id;
      setVideoId(video.id);
      // The Timeline voice panel shows exactly what was spoken
      await api.updateVideo(video.id, { narrationText: text });
      await api.generateVoice({ videoId: video.id, text, voiceId: prefs.voiceId, voiceName: prefs.voiceName, model: prefs.model });
      setDoneId(message.id);
    } catch (generateError) {
      setError({ messageId: message.id, text: cleanIpcError(generateError) });
    } finally {
      setPhase(null);
      setBusy(false);
      loadTrack().catch(() => {});
    }
  };

  return {
    configured,
    busy,
    videoId,
    track,
    phase,
    seconds,
    error,
    doneId,
    balance,
    voiceName: prefs.voiceName,
    request,
    confirm,
    cancelConfirm: () => setPhase(null),
    cancelGeneration: () => window.electronAPI?.cancelVoice(),
    openFolder: () =>
      window.electronAPI
        ?.openVoiceFolder(videoId)
        .catch((openError) => setError({ messageId: null, text: cleanIpcError(openError) })),
  };
}
