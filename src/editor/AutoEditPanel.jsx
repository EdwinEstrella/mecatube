// Presentational panel for automatic video editing and Remotion playback preview.
import { useState } from 'react';
import { Player } from '@remotion/player';
import VideoComposition, { compositionSize } from './VideoComposition.jsx';
import CaptionStyleEditor from './CaptionStyleEditor.jsx';
import { useAutoEdit } from './useAutoEdit.js';
import { formatDuration } from '../voice/constants.js';

function formatSyncStats(stats) {
  if (!stats || typeof stats.total !== 'number' || stats.total === 0) return null;
  const parts = [];
  const anchorCount = stats.anchor ?? 0;
  const totalCount = stats.total;
  parts.push(
    `${anchorCount} de ${totalCount} ${totalCount === 1 ? 'video sincronizado' : 'videos sincronizados'} con el guion`
  );
  if (stats.ai > 0) {
    parts.push(`${stats.ai} ${stats.ai === 1 ? 'ubicado' : 'ubicados'} por IA`);
  }
  if (stats.estimated > 0) {
    parts.push(`${stats.estimated} ${stats.estimated === 1 ? 'estimado' : 'estimados'}`);
  }
  return parts.join(' · ');
}

export default function AutoEditPanel({ videoId, onEdited, stages, ...customProps }) {
  const effectiveOnEdited = customProps.onEdited ?? onEdited;
  const effectiveStages = customProps.stages ?? stages;
  const hookResult = useAutoEdit(videoId, { onEdited: effectiveOnEdited, stages: effectiveStages });

  const status = customProps.status ?? hookResult.status;
  const missing = customProps.missing ?? hookResult.missing;
  const edl = customProps.edl ?? hookResult.edl;
  const syncStats = customProps.syncStats ?? hookResult.syncStats ?? edl?.syncStats;
  const adjustments = customProps.adjustments ?? hookResult.adjustments ?? 0;
  const notices = customProps.notices ?? hookResult.notices ?? [];
  const error = customProps.error ?? hookResult.error;
  const usedFallback = customProps.usedFallback ?? hookResult.usedFallback;
  const generate = customProps.generate ?? hookResult.generate;
  const runFallback = customProps.runFallback ?? hookResult.runFallback;
  const sources = customProps.sources ?? hookResult.sources;
  const audioUrl = customProps.audioUrl ?? hookResult.audioUrl;
  const words = customProps.words ?? hookResult.words ?? [];
  const clipDurations = customProps.clipDurations ?? hookResult.clipDurations;
  const captionStyle = customProps.captionStyle ?? hookResult.captionStyle;
  const setCaptionStyle = customProps.setCaptionStyle ?? hookResult.setCaptionStyle;
  const available = customProps.available ?? hookResult.available ?? [];
  const sceneImages = customProps.sceneImages ?? hookResult.sceneImages ?? {};

  const [notes, setNotes] = useState('');

  const isDirecting = status === 'directing';
  const isBlocked = isDirecting || status === 'loading' || status === 'missing';
  const primaryLabel = isDirecting ? 'La IA está editando…' : edl ? 'Volver a editar' : 'Editar con IA';

  const syncStatsText = formatSyncStats(syncStats);
  const hasNoAnchors = Boolean(syncStats && syncStats.total > 0 && (syncStats.anchor ?? 0) === 0);

  return (
    <div className="auto-edit">
      <div className="auto-edit__top-grid">
        <div className="auto-edit__player-col">
          {edl ? (
            <div className="auto-edit__player-wrapper">
              <Player
                component={VideoComposition}
                inputProps={{ edl, sources, audioUrl, clipDurations, words, captionStyle }}
                durationInFrames={Math.max(1, Math.round((edl.duration ?? 0) * compositionSize.fps))}
                compositionWidth={compositionSize.width}
                compositionHeight={compositionSize.height}
                fps={compositionSize.fps}
                controls
                style={{
                  width: '100%',
                  aspectRatio: '16 / 9',
                }}
              />
              <p className="settings__card-text auto-edit__note">
                La exportación a MP4 llegará en el siguiente paso.
              </p>
            </div>
          ) : (
            <div className="auto-edit__player-placeholder">
              <div className="auto-edit__player-placeholder-box">
                <span className="auto-edit__player-placeholder-icon" aria-hidden="true">🎬</span>
                <p className="auto-edit__player-placeholder-text">
                  Genera una edición para previsualizar el video con subtítulos y cortes sincronizados.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="auto-edit__action-card">
          <div className="auto-edit__action-header">
            <h4 className="auto-edit__title">Edición automática</h4>
          </div>

          {error && <p className="chat-messages__error auto-edit__error">{error}</p>}

          {status === 'missing' && missing.length > 0 && (
            <div className="auto-edit__missing">
              <ul className="auto-edit__missing-list">
                {missing.map((reason, index) => (
                  <li key={index} className="auto-edit__missing-item">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="auto-edit__notes">
            <label htmlFor="auto-edit-notes" className="auto-edit__label">
              Indicaciones para la IA (opcional)
            </label>
            <textarea
              id="auto-edit-notes"
              className="chat-list__rename auto-edit__textarea"
              value={notes}
              maxLength={500}
              disabled={isDirecting}
              placeholder="Indicaciones para la IA (opcional)"
              onChange={(e) => setNotes(e.target.value)}
            />
            <span className="auto-edit__char-count">{notes.length}/500</span>
          </div>

          <div className="auto-edit__actions">
            <button
              type="button"
              className="settings__button settings__button--primary"
              disabled={isBlocked}
              onClick={() => generate?.(notes)}
            >
              {primaryLabel}
            </button>
            <button
              type="button"
              className="settings__button settings__button--ghost"
              disabled={isBlocked}
              onClick={() => runFallback?.()}
            >
              Edición rápida sin IA
            </button>
          </div>

          {edl && (
            <div className="auto-edit__summary">
              <span className="auto-edit__summary-item">
                {edl.clips?.length ?? 0} {edl.clips?.length === 1 ? 'corte' : 'cortes'}
              </span>
              <span className="auto-edit__summary-separator">•</span>
              <span className="auto-edit__summary-item">{formatDuration(edl.duration)}</span>
              <span className="auto-edit__summary-separator">•</span>
              <span className="auto-edit__summary-item">
                {usedFallback ? 'Edición rápida sin IA' : 'Edición con IA'}
              </span>
            </div>
          )}

          {edl && syncStatsText && (
            <p className="settings__card-text auto-edit__note">
              {syncStatsText}
            </p>
          )}

          {edl && hasNoAnchors && (
            <p className="settings__card-text auto-edit__note">
              Este video se ilustró antes de las anclas del guion. Para sincronización exacta, vuelve a generar las imágenes con el Prompt 2 actualizado.
            </p>
          )}

          {notices && notices.length > 0 && (
            <div className="auto-edit__missing">
              <ul className="auto-edit__missing-list">
                {notices.map((notice, index) => (
                  <li key={index} className="auto-edit__missing-item">
                    {notice}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {adjustments > 0 && (
            <p className="settings__card-text auto-edit__note">
              La edición de la IA se corrigió automáticamente en {adjustments}{' '}
              {adjustments === 1 ? 'punto' : 'puntos'}.
            </p>
          )}
        </div>
      </div>

      <div className="auto-edit__caption-wrapper">
        <CaptionStyleEditor
          captionStyle={captionStyle}
          onChange={setCaptionStyle}
          sources={sources}
          sceneImages={sceneImages}
          available={available}
          words={words}
        />
      </div>
    </div>
  );
}
