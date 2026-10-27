// Presentational panel for automatic video editing and Remotion playback preview.
import { useEffect, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import VideoComposition, { compositionSize } from './VideoComposition.jsx';
import CaptionStyleEditor from './CaptionStyleEditor.jsx';
import { useAutoEdit } from './useAutoEdit.js';
import { buildPlan } from './plan.js';
import { formatDuration, cleanIpcError } from '../voice/constants.js';
import { exportVideo } from './exportVideo.js';

const TRANSITION_LABELS = {
  cut: 'Corte',
  fade: 'Fundido',
  zoom: 'Zoom',
  slide: 'Deslizar',
};

const MOTION_LABELS = {
  'zoom-in': 'Acercar',
  'zoom-out': 'Alejar',
  'pan-left': 'Paneo izquierda',
  'pan-right': 'Paneo derecha',
  none: 'Fijo',
};

function round3(num) {
  const rounded = Math.round((num + Number.EPSILON) * 1000) / 1000;
  return rounded === 0 ? 0 : rounded;
}

function formatSyncStats(stats) {
  if (!stats || typeof stats.total !== 'number' || stats.total === 0) return null;
  const parts = [];
  const aiCount = stats.ai ?? 0;
  const estCount = stats.estimated ?? 0;
  const anchorCount = stats.anchor ?? 0;
  parts.push(`${aiCount} por IA`);
  parts.push(`${estCount} ${estCount === 1 ? 'estimado' : 'estimados'}`);
  parts.push(`${anchorCount} por anclas del guion`);
  return `Ubicación: ${parts.join(' · ')}`;
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
  const videoTitle = customProps.videoTitle ?? hookResult.videoTitle ?? '';

  const [notes, setNotes] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportPercent, setExportPercent] = useState(0);
  const [exportError, setExportError] = useState('');
  const [exportedPath, setExportedPath] = useState('');
  const exportAbortControllerRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    let active = true;
    if (videoId && window.electronAPI?.getExport) {
      window.electronAPI.getExport(videoId)
        .then((latest) => {
          if (active && latest) {
            setExportedPath(latest);
          }
        })
        .catch(() => {});
    } else {
      setExportedPath('');
    }
    return () => {
      active = false;
    };
  }, [videoId]);

  useEffect(() => {
    return () => {
      exportAbortControllerRef.current?.abort();
    };
  }, []);

  const handleStartExport = async () => {
    if (!edl || isExporting) return;

    setIsExporting(true);
    setExportPercent(0);
    setExportError('');

    const controller = new AbortController();
    exportAbortControllerRef.current = controller;

    try {
      const durationInFrames = Math.max(1, Math.round((edl.duration ?? 0) * compositionSize.fps));
      const blob = await exportVideo({
        component: VideoComposition,
        durationInFrames,
        fps: compositionSize.fps,
        width: compositionSize.width,
        height: compositionSize.height,
        inputProps: { edl, sources, audioUrl, clipDurations, words, captionStyle },
        onProgress: (p) => {
          if (typeof p?.progress === 'number') {
            setExportPercent(Math.round(p.progress * 100));
          }
        },
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const buffer = await blob.arrayBuffer();
      const savedPath = await window.electronAPI?.saveExport?.({
        videoId,
        fileName: videoTitle || 'video-final',
        bytes: new Uint8Array(buffer),
      });

      if (!controller.signal.aborted) {
        setExportedPath(savedPath);
        setIsExporting(false);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setExportError(cleanIpcError(err));
        setIsExporting(false);
      }
    } finally {
      if (exportAbortControllerRef.current === controller) {
        exportAbortControllerRef.current = null;
      }
    }
  };

  const handleCancelExport = () => {
    if (exportAbortControllerRef.current) {
      exportAbortControllerRef.current.abort();
      exportAbortControllerRef.current = null;
    }
    setIsExporting(false);
    setExportPercent(0);
  };

  const handleOpenFolder = async () => {
    try {
      await window.electronAPI?.openExportFolder?.(videoId);
    } catch (err) {
      setExportError(cleanIpcError(err));
    }
  };

  const plan = edl ? buildPlan(edl, { fps: compositionSize.fps, clipDurations }) : null;
  const planItems = plan?.items ?? [];
  const totalDecisions = (edl?.clips?.length ?? 0) + (edl?.dropped?.length ?? 0);

  const isDirecting = status === 'directing';
  const isBlocked = isDirecting || status === 'loading' || status === 'missing' || isExporting;
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
                ref={playerRef}
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
              <div className="auto-edit__export-container">
                {isExporting ? (
                  <div className="auto-edit__export-progress-wrap">
                    <div className="auto-edit__export-progress-header">
                      <span className="auto-edit__export-progress-text">
                        Exportando… {exportPercent} %
                      </span>
                      <button
                        type="button"
                        className="settings__button settings__button--ghost"
                        onClick={handleCancelExport}
                      >
                        Cancelar
                      </button>
                    </div>
                    <div className="auto-edit__export-progress-bar">
                      <div
                        className="auto-edit__export-progress-fill"
                        style={{ width: `${Math.min(100, Math.max(0, exportPercent))}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="auto-edit__export-actions">
                    <button
                      type="button"
                      className="settings__button settings__button--primary"
                      disabled={isBlocked}
                      onClick={handleStartExport}
                    >
                      Exportar MP4
                    </button>

                    {exportedPath && (
                      <div className="auto-edit__export-success">
                        <span className="auto-edit__export-success-label">Video guardado</span>
                        <span className="auto-edit__export-path" title={exportedPath}>
                          {exportedPath}
                        </span>
                        <button
                          type="button"
                          className="settings__button settings__button--ghost"
                          onClick={handleOpenFolder}
                        >
                          Abrir carpeta
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {exportError && (
                  <p className="chat-messages__error auto-edit__error auto-edit__export-error">
                    {exportError}
                  </p>
                )}
              </div>
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
              disabled={isDirecting || isExporting}
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
              Este video se ilustró antes de las anclas del guion. Para sincronización exacta, vuelve a pedir las imágenes al ilustrador con el Prompt 2 actualizado.
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

          {edl && (
            <details className="auto-edit__decisions" open>
              <summary className="auto-edit__decisions-summary">
                Decisiones de edición ({totalDecisions})
              </summary>
              <div className="auto-edit__decisions-list">
                {edl.clips?.map((clip, index) => {
                  const planItem = planItems[index];
                  const isSlowed = (planItem?.playbackRate ?? 1) < 1;
                  const isFrozen = (planItem?.holdFrames ?? 0) > 0;
                  const durationSec = round3(clip.end - clip.start);
                  const timeRange = `${formatDuration(clip.start)}–${formatDuration(clip.end)}`;
                  const startFrame =
                    planItem?.startFrame ?? Math.round(clip.start * compositionSize.fps);

                  return (
                    <div
                      key={`clip-${clip.number}-${index}`}
                      className="auto-edit__decision-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => playerRef.current?.seekTo(startFrame)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          playerRef.current?.seekTo(startFrame);
                        }
                      }}
                    >
                      <div className="auto-edit__decision-header">
                        <span className="auto-edit__decision-time">{timeRange}</span>
                        <span className="auto-edit__decision-title">Video {clip.number}</span>
                        <span className="auto-edit__decision-dur">{durationSec} s</span>
                        <div className="auto-edit__decision-badges">
                          {clip.transition && TRANSITION_LABELS[clip.transition] && (
                            <span className="auto-edit__badge auto-edit__badge--transition">
                              {TRANSITION_LABELS[clip.transition]}
                            </span>
                          )}
                          {clip.motion && MOTION_LABELS[clip.motion] && (
                            <span className="auto-edit__badge auto-edit__badge--motion">
                              {MOTION_LABELS[clip.motion]}
                            </span>
                          )}
                          {isSlowed && (
                            <span className="auto-edit__badge auto-edit__badge--warning">
                              Ralentizado
                            </span>
                          )}
                          {isFrozen && (
                            <span className="auto-edit__badge auto-edit__badge--info">
                              Cuadro congelado
                            </span>
                          )}
                        </div>
                      </div>
                      {clip.reason && (
                        <p className="auto-edit__decision-reason">{clip.reason}</p>
                      )}
                    </div>
                  );
                })}

                {Array.isArray(edl.dropped) &&
                  edl.dropped.map((d, index) => (
                    <div
                      key={`dropped-${d.number}-${index}`}
                      className="auto-edit__decision-row auto-edit__decision-row--dropped"
                    >
                      <div className="auto-edit__decision-header">
                        <span className="auto-edit__decision-title">Video {d.number}</span>
                        <span className="auto-edit__badge auto-edit__badge--dropped">Descartado</span>
                      </div>
                      <p className="auto-edit__decision-reason">
                        Descartado: {d.reason || 'Sin justificación'}
                      </p>
                    </div>
                  ))}
              </div>
            </details>
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
