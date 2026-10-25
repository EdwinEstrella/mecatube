import { useEffect, useState } from 'react';
import { formatCredits } from './creditsText.js';

const formatDay = (ms) => new Date(ms).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
const formatDateTime = (ms) =>
  new Date(ms).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

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

  if (!summary) return <p className="settings__card-text">Cargando créditos…</p>;

  const share = summary.planCredits > 0 ? Math.min(100, (summary.usedThisCycle / summary.planCredits) * 100) : 0;

  return (
    <div className="credits">
      <h3 className="credits__title">Créditos</h3>
      <p className="credits__big">≈ {formatCredits(summary.remaining)} restantes (estimado)</p>
      <div className="credits__bar" role="progressbar" aria-valuemin={0} aria-valuemax={summary.planCredits} aria-valuenow={summary.usedThisCycle}>
        <div className="credits__bar-fill" style={{ width: `${share}%` }} />
      </div>
      <p className="settings__card-text">
        Usados en este ciclo: {formatCredits(summary.usedThisCycle)} de {formatCredits(summary.planCredits)} ·{' '}
        {formatDay(summary.cycleStart)} – {formatDay(summary.cycleEnd)} · Total histórico: {formatCredits(summary.totalAllTime)}
        {summary.calibrationActive && ` · Calibrado el ${formatDateTime(summary.calibration.at)}`}
      </p>

      <div className="prompt-editor__actions">
        <label className="credits__field">
          <span className="settings__card-text">Créditos del plan</span>
          <input
            className="chat-list__rename credits__input"
            type="number"
            min="1"
            value={plan}
            aria-label="Créditos del plan"
            onChange={(event) => setPlan(event.target.value)}
          />
        </label>
        <label className="credits__field">
          <span className="settings__card-text">Día de inicio del ciclo (1–28)</span>
          <input
            className="chat-list__rename credits__input credits__input--short"
            type="number"
            min="1"
            max="28"
            value={day}
            aria-label="Día de inicio del ciclo"
            onChange={(event) => setDay(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="settings__button settings__button--ghost"
          disabled={isBusy}
          onClick={() => onSaveSettings({ planCredits: Number(plan), cycleStartDay: Number(day) })}
        >
          Guardar plan
        </button>
      </div>

      <div className="prompt-editor__actions">
        <label className="credits__field">
          <span className="settings__card-text">Calibrar: me quedan</span>
          <input
            className="chat-list__rename credits__input"
            type="number"
            min="0"
            value={left}
            placeholder="créditos restantes"
            aria-label="Créditos restantes en el panel de Cartesia"
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
          Guardar
        </button>
        <button
          type="button"
          className="settings__button settings__button--ghost"
          disabled={isBusy || !summary.calibration}
          onClick={onClearCalibration}
        >
          Borrar calibración
        </button>
      </div>

      {message && <p className="prompt-editor__error">{message}</p>}

      <p className="settings__card-text">
        Cartesia no informa tu saldo a través de la API; se calcula a partir del uso propio de Mecatube. El uso
        de otras aplicaciones con la misma clave no se incluye: calibra con el número que aparece en tu panel de Cartesia.
        Las generaciones canceladas o fallidas pueden ser cobradas igualmente por Cartesia y no se cuentan.
      </p>

      {summary.recent.length > 0 && (
        <table className="credits__table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Video</th>
              <th className="credits__num">Caracteres</th>
              <th>Modelo</th>
            </tr>
          </thead>
          <tbody>
            {summary.recent.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDateTime(entry.at)}</td>
                <td className="credits__video">{entry.videoTitle || (entry.videoId ? 'Video' : 'Voz en off')}</td>
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
