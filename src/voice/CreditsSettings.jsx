import { useState } from 'react';
import CreditsPanel from './CreditsPanel.jsx';
import { cleanIpcError } from './constants.js';
import { useCreditSummary } from './useCreditSummary.js';

// Container: Settings credits block; every change is validated again by the main process
export default function CreditsSettings() {
  const summary = useCreditSummary();
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState('');

  const run = async (action) => {
    setIsBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(cleanIpcError(error));
    } finally {
      setIsBusy(false);
    }
  };

  const api = window.electronAPI;
  return (
    <CreditsPanel
      summary={summary}
      isBusy={isBusy}
      message={message}
      onSaveSettings={(settings) => run(() => api.saveCreditSettings(settings))}
      onCalibrate={(remaining) => run(() => api.calibrateCredits(remaining))}
      onClearCalibration={() => run(() => api.clearCreditCalibration())}
    />
  );
}
