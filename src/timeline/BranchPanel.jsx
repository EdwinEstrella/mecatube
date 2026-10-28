// Container for the branch view in the Timeline: series planner, title bank, or free mode.
import { useState, useCallback } from 'react';
import SeriesPlanner from './SeriesPlanner.jsx';
import TitleBank from './TitleBank.jsx';
import { buildSeriesOutlinePrompt, parseSeriesOutline } from '../prompts/seriesOutline.js';
import { buildSeriesChapterBrief, buildTitleBrief } from './briefHelpers.js';
import {
  getOrientationLabel,
  getVideoTypeLabel,
  getModeLabel,
  getCharacterModeLabel,
} from './branchHelpers.js';

export default function BranchPanel({
  branch,
  videos = [],
  videoStagesMap = {},
  onSelectVideo,
  onCreateVideo,
  onEditBranch,
  onBranchUpdated,
}) {
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [panelError, setPanelError] = useState('');

  const branchVideos = videos.filter((v) => v.branchId === branch?.id);

  // --- Series Mode Actions ---
  const handleSaveSeries = useCallback(
    async (seriesData) => {
      if (!branch?.id || !window.electronAPI) return;
      try {
        await window.electronAPI.updateBranch(branch.id, { series: seriesData });
        await onBranchUpdated?.();
      } catch (err) {
        setPanelError(err.message || 'Error al guardar la serie.');
        throw err;
      }
    },
    [branch?.id, onBranchUpdated]
  );

  const handleGenerateAiOutline = useCallback(
    async (formData) => {
      setAiError('');
      if (!window.electronAPI?.generateSeriesOutline) {
        setAiError('La función de generación con IA no está disponible.');
        return null;
      }

      setIsAiGenerating(true);
      try {
        const prompt = buildSeriesOutlinePrompt(formData);
        const { raw } = await window.electronAPI.generateSeriesOutline({ prompt });
        const parsed = parseSeriesOutline(raw, formData.chapters);
        if (parsed.length === 0) {
          setAiError('No se pudieron extraer capítulos de la respuesta de la IA. Puedes agregarlos manualmente.');
          return null;
        }
        return parsed;
      } catch (err) {
        const msg = err.message ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : '';
        setAiError(msg || 'Error al comunicarse con DeepSeek.');
        return null;
      } finally {
        setIsAiGenerating(false);
      }
    },
    []
  );

  const handleCreateChapterVideo = useCallback(
    async (chapter, seriesContext) => {
      if (!branch?.id || !window.electronAPI) return;
      setPanelError('');
      try {
        const brief = buildSeriesChapterBrief({
          series: seriesContext,
          chapter,
          outline: seriesContext.outline || [],
        });

        const title = `Cap. ${chapter.number} — ${chapter.title}`;
        const created = await window.electronAPI.createVideo({
          newVideo: true,
          branchId: branch.id,
          title,
          brief,
        });

        // Update outline with created videoId
        const updatedOutline = (seriesContext.outline || []).map((ch) =>
          ch.number === chapter.number ? { ...ch, videoId: created.id } : ch
        );

        await window.electronAPI.updateBranch(branch.id, {
          series: {
            ...seriesContext,
            outline: updatedOutline,
          },
        });

        window.dispatchEvent(
          new CustomEvent('mecatube:active-video-changed', { detail: { videoId: created.id } })
        );

        await onBranchUpdated?.();
      } catch (err) {
        setPanelError(err.message || 'Error al crear el video del capítulo.');
      }
    },
    [branch?.id, onBranchUpdated]
  );

  // --- Title Bank Mode Actions ---
  const handleSaveTitles = useCallback(
    async (titlesData) => {
      if (!branch?.id || !window.electronAPI) return;
      try {
        await window.electronAPI.updateBranch(branch.id, { titles: titlesData });
        await onBranchUpdated?.();
      } catch (err) {
        setPanelError(err.message || 'Error al guardar los títulos.');
        throw err;
      }
    },
    [branch?.id, onBranchUpdated]
  );

  const handleCreateTitleVideo = useCallback(
    async (titleItem) => {
      if (!branch?.id || !window.electronAPI) return;
      setPanelError('');
      try {
        const brief = buildTitleBrief(titleItem.text, branch);
        const created = await window.electronAPI.createVideo({
          newVideo: true,
          branchId: branch.id,
          title: titleItem.text,
          brief,
        });

        const currentTitles = branch.titles || [];
        const updatedTitles = currentTitles.map((t) =>
          t.id === titleItem.id ? { ...t, videoId: created.id } : t
        );

        await window.electronAPI.updateBranch(branch.id, { titles: updatedTitles });

        window.dispatchEvent(
          new CustomEvent('mecatube:active-video-changed', { detail: { videoId: created.id } })
        );

        await onBranchUpdated?.();
      } catch (err) {
        setPanelError(err.message || 'Error al crear el video desde el título.');
      }
    },
    [branch, onBranchUpdated]
  );

  if (!branch) {
    return (
      <div className="branch-panel branch-panel--empty">
        <p className="timeline__empty-text">Selecciona una rama para ver su configuración y contenido.</p>
      </div>
    );
  }

  return (
    <div className="branch-panel">
      {/* Branch overview bar */}
      <div className="branch-panel__top-bar">
        <div className="branch-panel__meta">
          <span className="branch-panel__name">{branch.name}</span>
          <div className="branch-tree__badges">
            <span className="branch-tree__badge branch-tree__badge--orientation">
              {getOrientationLabel(branch.orientation)}
            </span>
            <span className="branch-tree__badge branch-tree__badge--type">
              {getVideoTypeLabel(branch.videoType)}
            </span>
            <span className="branch-tree__badge branch-tree__badge--mode">
              {getModeLabel(branch.mode)}
            </span>
          </div>
        </div>

        <div className="branch-panel__top-actions">
          <button
            type="button"
            className="settings__button settings__button--ghost"
            onClick={() => onEditBranch?.(branch)}
          >
            Editar rama
          </button>
          <button
            type="button"
            className="settings__button settings__button--primary"
            onClick={() => onCreateVideo?.(branch.id)}
          >
            + Nuevo video
          </button>
        </div>
      </div>

      {panelError && <p className="chat-messages__error">{panelError}</p>}

      {/* Mode-specific content */}
      <div className="branch-panel__body">
        {branch.mode === 'series' && (
          <SeriesPlanner
            series={branch.series || {}}
            branchId={branch.id}
            onSaveSeries={handleSaveSeries}
            onGenerateAiOutline={handleGenerateAiOutline}
            onCreateChapterVideo={handleCreateChapterVideo}
            onOpenVideo={onSelectVideo}
            videoStagesMap={videoStagesMap}
            isAiGenerating={isAiGenerating}
            aiError={aiError}
          />
        )}

        {branch.mode === 'titles' && (
          <TitleBank
            titles={branch.titles || []}
            branch={branch}
            videos={videos}
            videoStagesMap={videoStagesMap}
            onSaveTitles={handleSaveTitles}
            onCreateTitleVideo={handleCreateTitleVideo}
            onOpenVideo={onSelectVideo}
          />
        )}

        {branch.mode === 'free' && (
          <div className="branch-panel__free-mode">
            <div className="branch-panel__free-card">
              <h3 className="branch-panel__free-title">Modo Libre</h3>
              <p className="branch-panel__free-desc">
                Esta rama permite crear videos independientes sin estructura fija de serie ni lista de títulos. Cada video tiene sus propios guiones e ilustraciones.
              </p>

              <div className="branch-panel__summary-grid">
                <div className="branch-panel__summary-item">
                  <span className="branch-panel__summary-label">Videos en la rama:</span>
                  <span className="branch-panel__summary-val">{branchVideos.length}</span>
                </div>
                <div className="branch-panel__summary-item">
                  <span className="branch-panel__summary-label">Orientación:</span>
                  <span className="branch-panel__summary-val">{getOrientationLabel(branch.orientation)}</span>
                </div>
                <div className="branch-panel__summary-item">
                  <span className="branch-panel__summary-label">Tipo de video:</span>
                  <span className="branch-panel__summary-val">{getVideoTypeLabel(branch.videoType)}</span>
                </div>
                <div className="branch-panel__summary-item">
                  <span className="branch-panel__summary-label">Personajes:</span>
                  <span className="branch-panel__summary-val">{getCharacterModeLabel(branch.characterMode)}</span>
                </div>
              </div>

              <div className="branch-panel__free-actions">
                <button
                  type="button"
                  className="settings__button settings__button--primary"
                  onClick={() => onCreateVideo?.(branch.id)}
                >
                  + Crear nuevo video en esta rama
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
