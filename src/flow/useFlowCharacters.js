import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureIllustratorVideo } from './illustratorVideo.js';
import { chooseVideoTarget } from '../ui/videoTargetDialog.js';
import { allSelected } from './characterStatus.js';

function cleanError(error) {
  return String(error?.message ?? error).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

const hasFlowApi = () => typeof window !== 'undefined' && Boolean(window.electronAPI?.generateCharacter);

// Container logic for the character cards of an illustrator chat. One Flow job runs at a time
// across the whole app; `job` is { videoId, characterKey, stage, percent, captcha } or null.
export function useFlowCharacters(conversationId, conversationTitle, isConnected) {
  const [videoId, setVideoId] = useState(null);
  const [projectUrl, setProjectUrl] = useState(null);
  // Stored records by character key
  const [records, setRecords] = useState({});
  const [job, setJob] = useState(null);
  // Per-character errors by key; `_` holds errors that belong to no card
  const [errors, setErrors] = useState({});
  const videoIdRef = useRef(null);
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  const setError = (key, message) => setErrors((current) => ({ ...current, [key]: message }));

  const load = useCallback(async () => {
    const api = window.electronAPI;
    if (!hasFlowApi() || !conversationId) {
      videoIdRef.current = null;
      setVideoId(null);
      setProjectUrl(null);
      setRecords({});
      return;
    }
    const videos = (await api.listVideos()) ?? [];
    const linked = videos.find((video) => video.illustratorConversationId === conversationId);
    if (conversationIdRef.current !== conversationId) return;
    videoIdRef.current = linked?.id ?? null;
    setVideoId(linked?.id ?? null);
    setProjectUrl(linked?.flowProjectUrl ?? null);
    const list = linked ? ((await api.getCharacters(linked.id)) ?? []) : [];
    if (conversationIdRef.current !== conversationId) return;
    setRecords(Object.fromEntries(list.map((item) => [item.key, item])));
  }, [conversationId]);

  useEffect(() => {
    setErrors({});
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    if (!hasFlowApi()) return undefined;
    const api = window.electronAPI;
    api.getFlowStatus().then(
      (status) => {
        if (status.busy) {
          setJob((current) => current ?? { videoId: status.videoId, characterKey: status.characterKey, stage: 'generating', percent: null, captcha: false });
        }
      },
      () => {},
    );
    const offProgress = api.onFlowProgress(({ videoId: id, characterKey, stage, percent }) => {
      setJob((current) => ({ captcha: false, ...current, videoId: id, characterKey, stage, percent }));
      if (stage === 'project') load().catch(() => {});
    });
    const offCaptcha = api.onFlowCaptcha(({ videoId: id, characterKey, active }) => {
      setJob((current) => ({ stage: 'generating', percent: null, ...current, videoId: id, characterKey, captcha: active }));
    });
    const offResult = api.onFlowResult(({ videoId: id, character }) => {
      setJob(null);
      if (id === videoIdRef.current) setRecords((current) => ({ ...current, [character.key]: character }));
      load().catch(() => {});
    });
    const offError = api.onFlowError(({ characterKey, message }) => {
      setJob(null);
      setError(characterKey, message);
    });
    return () => {
      offProgress();
      offCaptcha();
      offResult();
      offError();
    };
  }, [load]);

  // card: { key, title, role, prompt }
  const generate = async (card) => {
    const api = window.electronAPI;
    setErrors((current) => ({ ...current, [card.key]: '' }));
    setJob({ videoId: null, characterKey: card.key, stage: 'starting', percent: null, captcha: false });
    try {
      const video = await ensureIllustratorVideo(api, conversationId, conversationTitle, chooseVideoTarget);
      if (!video) {
        setJob(null);
        return;
      }
      videoIdRef.current = video.id;
      setVideoId(video.id);
      setProjectUrl(video.flowProjectUrl ?? null);
      setJob((current) => (current ? { ...current, videoId: video.id } : current));
      await api.generateCharacter({ videoId: video.id, characterKey: card.key, name: card.title, role: card.role, prompt: card.prompt });
      const list = (await api.getCharacters(video.id)) ?? [];
      setRecords(Object.fromEntries(list.map((item) => [item.key, item])));
    } catch (generateError) {
      setJob(null);
      setError(card.key, cleanError(generateError));
    }
  };

  const select = async (key, file) => {
    try {
      const updated = await window.electronAPI.selectCharacterImage(videoIdRef.current, key, file);
      setRecords((current) => ({ ...current, [key]: updated }));
    } catch (selectError) {
      setError(key, cleanError(selectError));
    }
  };

  // Returns true when every card has an image and the approval was stored
  const approve = async (keys) => {
    if (!allSelected(records, keys)) {
      setError('_', 'Elige una imagen para cada personaje antes de aprobar.');
      return false;
    }
    try {
      await window.electronAPI.approveCharacters(videoIdRef.current, keys, true);
      setError('_', '');
      await load();
      return true;
    } catch (approveError) {
      setError('_', cleanError(approveError));
      return false;
    }
  };

  const unapprove = async (keys) => {
    if (!videoIdRef.current) return;
    try {
      await window.electronAPI.approveCharacters(videoIdRef.current, keys, false);
      await load();
    } catch {
      // Requesting changes must still reach the chat
    }
  };

  const openProject = async () => {
    try {
      await window.electronAPI.openFlowProject(videoIdRef.current);
    } catch (openError) {
      setError('_', cleanError(openError));
    }
  };

  return {
    available: hasFlowApi(),
    videoId,
    projectUrl,
    records,
    job,
    errors,
    connected: isConnected,
    generate,
    select,
    approve,
    unapprove,
    openProject,
  };
}
