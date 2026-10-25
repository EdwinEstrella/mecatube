import { useCallback, useEffect, useState } from 'react';
import { cleanIpcError } from './constants.js';

// Container logic for the user's own voices: Cartesia-owned ones, the ones saved in Mecatube,
// and lookup by pasted id. Owned voices load on demand (they need the API key and a request).
export function useVoiceLibrary() {
  const api = window.electronAPI;
  const [configured, setConfigured] = useState(null);
  const [owned, setOwned] = useState([]);
  const [isLoadingOwned, setIsLoadingOwned] = useState(false);
  const [ownedError, setOwnedError] = useState('');
  const [hasLoadedOwned, setHasLoadedOwned] = useState(false);
  const [saved, setSaved] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!api) return;
    api.getCartesiaStatus().then((status) => setConfigured(status.configured), () => setConfigured(false));
    api.listSavedVoices().then(setSaved, (listError) => setError(cleanIpcError(listError)));
  }, [api]);

  const loadOwned = useCallback(
    async (refresh = false) => {
      if (!api) return;
      setIsLoadingOwned(true);
      setOwnedError('');
      try {
        setOwned(await api.listOwnedVoices({ refresh }));
        setHasLoadedOwned(true);
      } catch (loadError) {
        setOwnedError(cleanIpcError(loadError));
      } finally {
        setIsLoadingOwned(false);
      }
    },
    [api],
  );

  const run = async (action) => {
    setError('');
    try {
      setSaved(await action());
      return true;
    } catch (actionError) {
      setError(cleanIpcError(actionError));
      return false;
    }
  };

  return {
    configured,
    owned,
    isLoadingOwned,
    ownedError,
    hasLoadedOwned,
    saved,
    error,
    loadOwned,
    // Resolves to the voice, or null when Cartesia does not know the id; rejects on other failures
    lookup: (id) => api.lookupVoice(id),
    save: ({ id, name, label }) => run(() => api.addSavedVoice({ id, name, label })),
    rename: (id, label) => run(() => api.renameSavedVoice(id, label)),
    remove: (id) => run(() => api.removeSavedVoice(id)),
  };
}
