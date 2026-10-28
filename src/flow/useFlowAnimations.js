import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureIllustratorVideo } from './illustratorVideo.js';
import { chooseVideoTarget } from '../ui/videoTargetDialog.js';
import { isActive } from './sceneStatus.js';
import { animationSeconds } from './animationSeconds.js';

function cleanError(error) {
  return String(error?.message ?? error).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

const hasAnimationsApi = () => typeof window !== 'undefined' && Boolean(window.electronAPI?.generateAnimations);

// Container logic for the animation cards of an illustrator chat. The main process runs the serial
// Flow queue it shares with the scenes; this hook sends animations, mirrors the per-animation status
// events and loads the stored videos. `scenes` is the useFlowScenes result: it owns the video and
// the chosen scene images that serve as start frames. `statuses` is by number: { state, percent,
// captcha, error }; `records` the stored animations.
export function useFlowAnimations(conversationId, conversationTitle, isConnected, scenes, reloadKey = null) {
  const videoId = scenes?.videoId ?? null;
  const [records, setRecords] = useState({});
  const [statuses, setStatuses] = useState({});
  const [error, setError] = useState('');
  const videoIdRef = useRef(null);
  videoIdRef.current = videoId;

  useEffect(() => {
    setError('');
    setStatuses({});
  }, [conversationId]);

  useEffect(() => {
    let cancelled = false;
    if (!hasAnimationsApi() || !videoId) {
      setRecords({});
      return undefined;
    }
    window.electronAPI.getAnimations(videoId).then(
      (list) => {
        if (!cancelled) setRecords(Object.fromEntries((list ?? []).map((item) => [item.number, item])));
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [videoId, reloadKey]);

  useEffect(() => {
    if (!hasAnimationsApi()) return undefined;
    const api = window.electronAPI;
    // A queue already running (window reloaded) shows up as busy until its events arrive
    api.getFlowStatus().then(
      (status) => {
        const running = status?.animations?.running;
        if (running) setStatuses((current) => ({ [running]: { state: 'running', percent: null, captcha: false, error: null }, ...current }));
      },
      () => {},
    );
    return api.onFlowAnimationStatus(({ videoId: id, number, state, percent, captcha, error: message, animation }) => {
      if (id !== videoIdRef.current) return;
      setStatuses((current) => ({ ...current, [number]: { state, percent, captcha, error: message } }));
      if (state === 'done' && animation) setRecords((current) => ({ ...current, [number]: animation }));
    });
  }, []);

  // list: [{ number, title, prompt, hook, seconds, scriptAnchor }] in the order they must run
  const generate = useCallback(
    async (list) => {
      const api = window.electronAPI;
      setError('');
      try {
        const video = await ensureIllustratorVideo(api, conversationId, conversationTitle, chooseVideoTarget);
        if (!video) return;
        await api.generateAnimations({
          videoId: video.id,
          animations: list.map(({ number, title, prompt, hook, seconds, scriptAnchor }) => ({
            number,
            title,
            prompt,
            hook: hook === true,
            seconds: seconds ?? animationSeconds(scriptAnchor),
          })),
        });
      } catch (generateError) {
        setError(cleanError(generateError));
      }
    },
    [conversationId, conversationTitle],
  );

  const cancel = async () => {
    try {
      await window.electronAPI.cancelAnimations();
    } catch (cancelError) {
      setError(cleanError(cancelError));
    }
  };

  return {
    available: hasAnimationsApi(),
    videoId,
    records,
    statuses,
    error,
    connected: isConnected,
    busy: Object.values(statuses).some(isActive),
    generate,
    cancel,
  };
}
