import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureIllustratorVideo } from './illustratorVideo.js';
import { isActive } from './sceneStatus.js';

function cleanError(error) {
  return String(error?.message ?? error).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

const hasScenesApi = () => typeof window !== 'undefined' && Boolean(window.electronAPI?.generateScenes);

// Container logic for the scene cards of an illustrator chat. The main process runs the serial
// queue; this hook sends scenes, mirrors the per-scene status events and loads the stored images.
// `statuses` is by scene number: { state, percent, captcha, error }; `records` the stored scenes.
export function useFlowScenes(conversationId, conversationTitle, isConnected) {
  const [videoId, setVideoId] = useState(null);
  const [projectUrl, setProjectUrl] = useState(null);
  const [records, setRecords] = useState({});
  const [statuses, setStatuses] = useState({});
  const [error, setError] = useState('');
  const videoIdRef = useRef(null);
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  const load = useCallback(async () => {
    const api = window.electronAPI;
    if (!hasScenesApi() || !conversationId) {
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
    const list = linked ? ((await api.getScenes(linked.id)) ?? []) : [];
    if (conversationIdRef.current !== conversationId) return;
    setRecords(Object.fromEntries(list.map((item) => [item.number, item])));
  }, [conversationId]);

  useEffect(() => {
    setError('');
    setStatuses({});
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    if (!hasScenesApi()) return undefined;
    const api = window.electronAPI;
    // A queue already running (window reloaded) shows up as busy until its events arrive
    api.getFlowStatus().then(
      (status) => {
        const running = status?.scenes?.running;
        if (running) setStatuses((current) => ({ [running]: { state: 'running', percent: null, captcha: false, error: null }, ...current }));
      },
      () => {},
    );
    return api.onFlowSceneStatus(({ videoId: id, number, state, percent, captcha, error: message, scene }) => {
      if (id !== videoIdRef.current) return;
      setStatuses((current) => ({ ...current, [number]: { state, percent, captcha, error: message } }));
      if (state === 'done' && scene) setRecords((current) => ({ ...current, [number]: scene }));
      if (state === 'running') load().catch(() => {});
    });
  }, [load]);

  // list: [{ number, title, prompt, sheetRefs }] in the order they must run
  const generate = async (list) => {
    const api = window.electronAPI;
    setError('');
    try {
      const video = await ensureIllustratorVideo(api, conversationId, conversationTitle);
      videoIdRef.current = video.id;
      setVideoId(video.id);
      setProjectUrl(video.flowProjectUrl ?? null);
      await api.generateScenes({
        videoId: video.id,
        scenes: list.map(({ number, title, prompt, sheetRefs }) => ({ number, title, prompt, sheetRefs })),
      });
    } catch (generateError) {
      setError(cleanError(generateError));
    }
  };

  const cancel = async () => {
    try {
      await window.electronAPI.cancelScenes();
    } catch (cancelError) {
      setError(cleanError(cancelError));
    }
  };

  const openProject = async () => {
    try {
      await window.electronAPI.openFlowProject(videoIdRef.current);
    } catch (openError) {
      setError(cleanError(openError));
    }
  };

  return {
    available: hasScenesApi(),
    videoId,
    projectUrl,
    records,
    statuses,
    error,
    connected: isConnected,
    busy: Object.values(statuses).some(isActive),
    generate,
    cancel,
    openProject,
  };
}
