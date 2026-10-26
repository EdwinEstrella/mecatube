import { useCallback, useEffect, useState } from 'react';

const INITIAL = { status: 'idle' };

// Wraps the main-process updater: current state plus check / download / install actions
export function useUpdates() {
  const [state, setState] = useState(INITIAL);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onUpdateState) return undefined;
    api.getUpdateState?.().then((current) => current && setState(current));
    const offState = api.onUpdateState(setState);
    const offProgress = api.onUpdateProgress?.(({ percent }) => {
      setState((prev) => (prev.status === 'downloading' ? { ...prev, percent } : prev));
    });
    return () => {
      offState();
      offProgress?.();
    };
  }, []);

  // 'none' is a brief confirmation; fall back to idle afterwards
  useEffect(() => {
    if (state.status !== 'none') return undefined;
    const timer = setTimeout(() => setState(INITIAL), 4000);
    return () => clearTimeout(timer);
  }, [state.status]);

  const check = useCallback(() => window.electronAPI?.checkForUpdates?.().then(setState), []);
  const download = useCallback(() => window.electronAPI?.downloadUpdate?.(), []);
  const install = useCallback(() => window.electronAPI?.installUpdate?.(), []);

  return { state, check, download, install };
}
