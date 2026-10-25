import { useEffect, useState } from 'react';

// Estimated Cartesia balance and usage from the local ledger; null until loaded
export function useCreditSummary() {
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return undefined;
    let alive = true;
    const load = () =>
      api.getCreditSummary().then(
        (value) => alive && setSummary(value),
        () => {},
      );
    load();
    const off = api.onCreditsChanged(load);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return summary;
}
