import { useEffect, useState } from 'react';
import { formatCredits } from './creditsText.js';

const formatDay = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const formatDateTime = (ms) =>
  new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// Presentational: estimated Cartesia balance, plan settings, calibration and recent usage
export default function CreditsPanel({ summary, isBusy, message, onSaveSettings, onCalibrate, onClearCalibration }) {
  const [plan, setPlan] = useState('');
  const [day, setDay] = useState('');
  const [left, setLeft] = useState('');

  useEffect(() => {
    if (!summary) return;
    setPlan(String(summary.planCredits));
    setDay(String(summary.cycleStartDay));
  }, [summary?.planCredits, summary?.cycleStartDay]);

  if (!summary) return <p className="settings__card-text">Loading credits…</p>;

  const share = summary.planCredits > 0 ? Math.min(100, (summary.usedThisCycle / summary.planCredits) * 100) : 0;

  return (
    <div className="credits">
      <h3 className="credits__title">Credits</h3>
      <p className="credits__big">≈ {formatCredits(summary.remaining)} remaining (estimate)</p>
      <div className="credits__bar" role="progressbar" aria-valuemin={0} aria-valuemax={summary.planCredits} aria-valuenow={summary.usedThisCycle}>
        <div className="credits__bar-fill" style={{ width: `${share}%` }} />
      </div>
      <p className="settings__card-text">
        Used this cycle: {formatCredits(summary.usedThisCycle)} of {formatCredits(summary.planCredits)} ·{' '}
        {formatDay(summary.cycleStart)} – {formatDay(summary.cycleEnd)} · All time: {formatCredits(summary.totalAllTime)}
        {summary.calibrationActive && ` · Calibrated on ${formatDateTime(summary.calibration.at)}`}
      </p>

      <div className="prompt-editor__actions">
        <label className="credits__field">
          <span className="settings__card-text">Plan credits</span>
          <input
            className="chat-list__rename credits__input"
            type="number"
            min="1"
            value={plan}
            aria-label="Plan credits"
            onChange={(event) => setPlan(event.target.value)}
          />
        </label>
        <label className="credits__field">
          <span className="settings__card-text">Cycle start day (1–28)</span>
          <input
            className="chat-list__rename credits__input credits__input--short"
            type="number"
            min="1"
            max="28"
            value={day}
            aria-label="Cycle start day"
            onChange={(event) => setDay(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="settings__button settings__button--ghost"
          disabled={isBusy}
          onClick={() => onSaveSettings({ planCredits: Number(plan), cycleStartDay: Number(day) })}
        >
          Save plan
        </button>
      </div>

      <div className="prompt-editor__actions">
        <label className="credits__field">
          <span className="settings__card-text">Calibrate: I have</span>
          <input
            className="chat-list__rename credits__input"
            type="number"
            min="0"
            value={left}
            placeholder="credits left"
            aria-label="Credits left on the Cartesia dashboard"
            onChange={(event) => setLeft(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="settings__button settings__button--primary"
          disabled={isBusy || left.trim() === ''}
          onClick={() => {
            onCalibrate(Number(left));
            setLeft('');
          }}
        >
          Save
        </button>
        <button
          type="button"
          className="settings__button settings__button--ghost"
          disabled={isBusy || !summary.calibration}
          onClick={onClearCalibration}
        >
          Clear calibration
        </button>
      </div>

      {message && <p className="prompt-editor__error">{message}</p>}

      <p className="settings__card-text">
        Cartesia doesn&apos;t report your balance through the API; this is calculated from Mecatube&apos;s own usage. Usage
        from other apps with the same key isn&apos;t included — calibrate with the number shown on your Cartesia dashboard.
        Cancelled or failed generations may still be charged by Cartesia and are not counted.
      </p>

      {summary.recent.length > 0 && (
        <table className="credits__table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Video</th>
              <th className="credits__num">Characters</th>
              <th>Model</th>
            </tr>
          </thead>
          <tbody>
            {summary.recent.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDateTime(entry.at)}</td>
                <td className="credits__video">{entry.videoTitle || (entry.videoId ? 'Video' : 'Voice-over')}</td>
                <td className="credits__num">{formatCredits(entry.chars)}</td>
                <td>{entry.model}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
