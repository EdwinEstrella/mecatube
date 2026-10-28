// Kit for publication in the timeline "Publicado" stage.
// Supports YouTube (horizontal) and multi-platform (vertical: Shorts, TikTok, Reels).
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { parseMetadata } from './parseMetadata.js';
import { sceneImageUrl } from '../flow/sceneStatus.js';
import { THUMBNAIL_NUMBER } from '../flow/parseThumbnail.js';

export function CopyButton({
  text,
  label = 'Copiar',
  copiedLabel = 'Copiado',
  className = 'settings__button settings__button--ghost',
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <button type="button" className={className} onClick={handleCopy} disabled={!text}>
      {copied ? copiedLabel : label}
    </button>
  );
}

export function usePublishKit(video, scriptMessages) {
  const [exportPath, setExportPath] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [savedThumbnailPath, setSavedThumbnailPath] = useState(null);
  const [messages, setMessages] = useState(scriptMessages ?? []);
  const [isSavingThumbnail, setIsSavingThumbnail] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const videoId = video?.id;
  const scriptConversationId = video?.scriptConversationId;

  const refresh = useCallback(async () => {
    if (!videoId || typeof window === 'undefined' || !window.electronAPI) return;
    const api = window.electronAPI;

    try {
      const exp = await api.getExport(videoId);
      setExportPath(exp);
    } catch {}

    try {
      const scenes = (await api.getScenes(videoId)) ?? [];
      const thumbScene = scenes.find((s) => s.number === THUMBNAIL_NUMBER);
      if (thumbScene) {
        const file =
          thumbScene.selectedFile ||
          (thumbScene.generations?.length
            ? thumbScene.generations[thumbScene.generations.length - 1]?.files?.[0]
            : null);
        setThumbnailFile(file ?? null);
      } else {
        setThumbnailFile(null);
      }
    } catch {}
  }, [videoId]);

  useEffect(() => {
    if (scriptMessages && scriptMessages.length > 0) {
      setMessages(scriptMessages);
      return;
    }
    if (!scriptConversationId || typeof window === 'undefined' || !window.electronAPI?.getConversation) {
      setMessages([]);
      return;
    }
    window.electronAPI
      .getConversation(scriptConversationId)
      .then((conv) => {
        setMessages(conv?.messages ?? []);
      })
      .catch(() => {
        setMessages([]);
      });
  }, [scriptConversationId, scriptMessages]);

  useEffect(() => {
    setSavedThumbnailPath(null);
    setSaveError(null);
    refresh();
  }, [refresh]);

  const metadata = useMemo(() => parseMetadata(messages), [messages]);

  const handleOpenFolder = useCallback(() => {
    if (!videoId || typeof window === 'undefined' || !window.electronAPI?.openExportFolder) return;
    window.electronAPI.openExportFolder(videoId).catch(() => {});
  }, [videoId]);

  const handleSaveThumbnail = useCallback(async () => {
    if (!videoId || !thumbnailFile || typeof window === 'undefined' || !window.electronAPI?.saveThumbnail) return;
    setIsSavingThumbnail(true);
    setSaveError(null);
    try {
      const sourcePath = `scenes/${THUMBNAIL_NUMBER}/${thumbnailFile}`;
      const saved = await window.electronAPI.saveThumbnail({ videoId, sourcePath });
      setSavedThumbnailPath(saved);
    } catch (err) {
      setSaveError(err.message || 'Error al guardar la miniatura.');
    } finally {
      setIsSavingThumbnail(false);
    }
  }, [videoId, thumbnailFile]);

  const videoFileName = useMemo(() => {
    if (!exportPath) return null;
    return exportPath.split(/[/\\]/).pop();
  }, [exportPath]);

  const thumbnailUrl = useMemo(() => {
    if (!videoId || !thumbnailFile) return null;
    return sceneImageUrl(videoId, THUMBNAIL_NUMBER, thumbnailFile);
  }, [videoId, thumbnailFile]);

  return {
    exportPath,
    videoFileName,
    thumbnailFile,
    thumbnailUrl,
    savedThumbnailPath,
    isSavingThumbnail,
    saveError,
    metadata,
    openFolder: handleOpenFolder,
    saveThumbnail: handleSaveThumbnail,
  };
}

const PLATFORM_TABS = [
  { id: 'shorts', label: 'YouTube Shorts' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'reels', label: 'Reels' },
];

export default function PublishKit({ video, scriptMessages, orientation = 'horizontal' }) {
  const {
    exportPath,
    videoFileName,
    thumbnailUrl,
    savedThumbnailPath,
    isSavingThumbnail,
    saveError,
    metadata,
    openFolder,
    saveThumbnail,
  } = usePublishKit(video, scriptMessages);

  const [activeTab, setActiveTab] = useState('shorts');

  const isVertical = orientation === 'vertical' || Boolean(metadata?.platforms);

  const tagsString = metadata?.tags?.join(', ') ?? '';
  const isTagsOverLimit =
    (metadata?.tags?.join(',')?.length ?? 0) > 500 || tagsString.length > 500;

  const shorts = metadata?.platforms?.youtubeShorts;
  const tiktok = metadata?.platforms?.tiktok;
  const reels = metadata?.platforms?.instagramReels;

  const shortsTitle = shorts?.title || (metadata?.titles?.[0] ?? '');
  const shortsTagsString = shorts?.tags?.join(', ') || tagsString;

  const tiktokCaption = tiktok?.caption || '';
  const tiktokHashtagsString = tiktok?.hashtags?.join(' ') || '';

  const reelsCaption = reels?.caption || '';
  const reelsHashtagsString = reels?.hashtags?.join(' ') || '';

  return (
    <div className="publish-kit">
      <div className="publish-kit__intro">
        <h3 className="video-detail__stage-heading">
          {isVertical ? 'Kit de publicación (Shorts, TikTok, Reels)' : 'Kit para YouTube'}
        </h3>
        <p className="video-detail__stage-hint">
          {isVertical
            ? 'Marca esta etapa cuando el video esté publicado. Aquí tienes el contenido adaptado para cada red.'
            : 'Marca esta etapa cuando el video esté publicado en YouTube. Aquí tienes todo el material necesario.'}
        </p>
      </div>

      {/* 1. Video file */}
      <div className="settings__card">
        <div className="settings__card-header">
          <div>
            <h4 className="settings__card-title">Archivo de video</h4>
            <p className="settings__card-text">El archivo de video final exportado listo para subir.</p>
          </div>
          {exportPath && (
            <button
              type="button"
              className="settings__button settings__button--ghost"
              onClick={openFolder}
            >
              Abrir carpeta
            </button>
          )}
        </div>

        {exportPath ? (
          <div className="publish-kit__file-info">
            <span className="publish-kit__filename">{videoFileName}</span>
            <span className="publish-kit__path">{exportPath}</span>
          </div>
        ) : (
          <p className="settings__empty">
            Aún no exportaste el video. Ve a Edición y pulsa «Exportar MP4».
          </p>
        )}
      </div>

      {/* 2. Miniatura */}
      <div className="settings__card">
        <div className="settings__card-header">
          <div>
            <h4 className="settings__card-title">Miniatura</h4>
            <p className="settings__card-text">
              {isVertical ? 'Miniatura vertical 9:16 generada para el video.' : 'La miniatura seleccionada del video en Flow.'}
            </p>
          </div>
          {thumbnailUrl && (
            <button
              type="button"
              className="settings__button settings__button--ghost"
              disabled={isSavingThumbnail}
              onClick={saveThumbnail}
            >
              {isSavingThumbnail ? 'Guardando…' : 'Guardar miniatura'}
            </button>
          )}
        </div>

        {thumbnailUrl ? (
          <div className="publish-kit__thumb-section">
            <div
              className={`publish-kit__thumb-preview-wrapper${
                isVertical ? ' publish-kit__thumb-preview-wrapper--vertical' : ''
              }`}
            >
              <img
                src={thumbnailUrl}
                alt={isVertical ? 'Miniatura vertical 9:16' : 'Miniatura de YouTube'}
                className="publish-kit__thumb-preview"
              />
            </div>
            {metadata?.thumbnailText && (
              <p className="publish-kit__thumb-text">
                Texto en miniatura: <strong>{metadata.thumbnailText}</strong>
              </p>
            )}
            {savedThumbnailPath && (
              <p className="publish-kit__saved-path">
                Guardada en: <code>{savedThumbnailPath}</code>
              </p>
            )}
            {saveError && <p className="publish-kit__warning">{saveError}</p>}
          </div>
        ) : (
          <p className="settings__empty">Aún no hay miniatura generada.</p>
        )}
      </div>

      {/* 3. Metadata */}
      {metadata ? (
        <div className="settings__card">
          <div className="settings__card-header">
            <div>
              <h4 className="settings__card-title">Metadatos de publicación</h4>
              <p className="settings__card-text">
                {isVertical
                  ? 'Contenido optimizado por plataforma: YouTube Shorts, TikTok e Instagram Reels.'
                  : 'Generados en el chat del guion para optimizar el CTR y el posicionamiento.'}
              </p>
            </div>
          </div>

          {isVertical ? (
            <>
              {/* Platform tabs */}
              <div className="publish-kit__tabs" role="tablist" aria-label="Plataformas">
                {PLATFORM_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    className={`publish-kit__tab${activeTab === tab.id ? ' publish-kit__tab--active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* YouTube Shorts Tab */}
              {activeTab === 'shorts' && (
                <div className="publish-kit__platform-content" role="tabpanel">
                  {/* Title */}
                  <div className="publish-kit__subcard">
                    <div className="publish-kit__subcard-header">
                      <h5 className="publish-kit__subtitle">
                        Título {shortsTitle ? `(${shortsTitle.length}/100)` : ''}
                      </h5>
                      <CopyButton text={shortsTitle} label="Copiar título" />
                    </div>
                    {shortsTitle.length > 100 && (
                      <p className="publish-kit__warning">
                        El título supera los 100 caracteres recomendados para YouTube Shorts.
                      </p>
                    )}
                    <p className="publish-kit__title-text" style={{ padding: '8px 12px', background: 'var(--surface-sunken)', borderRadius: '6px' }}>
                      {shortsTitle || 'Sin título generado.'}
                    </p>
                  </div>

                  {/* Description */}
                  <div className="publish-kit__subcard">
                    <div className="publish-kit__subcard-header">
                      <h5 className="publish-kit__subtitle">Descripción</h5>
                      <CopyButton text={shorts?.description || metadata.description} />
                    </div>
                    <textarea
                      className="publish-kit__textarea"
                      readOnly
                      rows={6}
                      value={shorts?.description || metadata.description || ''}
                    />
                  </div>

                  {/* Tags */}
                  <div className="publish-kit__subcard">
                    <div className="publish-kit__subcard-header">
                      <h5 className="publish-kit__subtitle">
                        Etiquetas {(shorts?.tags || metadata.tags).length > 0 && `(${(shorts?.tags || metadata.tags).length})`}
                      </h5>
                      <CopyButton text={shortsTagsString} label="Copiar etiquetas" />
                    </div>
                    {(shorts?.tags || metadata.tags).length > 0 ? (
                      <div className="publish-kit__tags-grid">
                        {(shorts?.tags || metadata.tags).map((tag, index) => (
                          <span key={index} className="publish-kit__tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="settings__empty">No se encontraron etiquetas para Shorts.</p>
                    )}
                  </div>
                </div>
              )}

              {/* TikTok Tab */}
              {activeTab === 'tiktok' && (
                <div className="publish-kit__platform-content" role="tabpanel">
                  {/* Caption */}
                  <div className="publish-kit__subcard">
                    <div className="publish-kit__subcard-header">
                      <h5 className="publish-kit__subtitle">
                        Descripción / Caption {tiktokCaption ? `(${tiktokCaption.length}/150)` : ''}
                      </h5>
                      <CopyButton text={tiktokCaption} label="Copiar caption" />
                    </div>
                    {tiktokCaption.length > 150 && (
                      <p className="publish-kit__warning">
                        El caption supera los 150 caracteres recomendados para TikTok.
                      </p>
                    )}
                    <textarea
                      className="publish-kit__textarea"
                      readOnly
                      rows={5}
                      value={tiktokCaption}
                    />
                  </div>

                  {/* Hashtags */}
                  <div className="publish-kit__subcard">
                    <div className="publish-kit__subcard-header">
                      <h5 className="publish-kit__subtitle">
                        Hashtags {tiktok?.hashtags?.length > 0 && `(${tiktok.hashtags.length})`}
                      </h5>
                      <CopyButton text={tiktokHashtagsString} label="Copiar hashtags" />
                    </div>
                    {tiktok?.hashtags?.length > 0 ? (
                      <div className="publish-kit__tags-grid">
                        {tiktok.hashtags.map((tag, index) => (
                          <span key={index} className="publish-kit__tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="settings__empty">No se encontraron hashtags específicos de TikTok.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Reels Tab */}
              {activeTab === 'reels' && (
                <div className="publish-kit__platform-content" role="tabpanel">
                  {/* Caption */}
                  <div className="publish-kit__subcard">
                    <div className="publish-kit__subcard-header">
                      <h5 className="publish-kit__subtitle">Descripción / Caption</h5>
                      <CopyButton text={reelsCaption} label="Copiar caption" />
                    </div>
                    <textarea
                      className="publish-kit__textarea"
                      readOnly
                      rows={6}
                      value={reelsCaption}
                    />
                  </div>

                  {/* Hashtags */}
                  <div className="publish-kit__subcard">
                    <div className="publish-kit__subcard-header">
                      <h5 className="publish-kit__subtitle">
                        Hashtags {reels?.hashtags?.length > 0 && `(${reels.hashtags.length})`}
                      </h5>
                      <CopyButton text={reelsHashtagsString} label="Copiar hashtags" />
                    </div>
                    {reels?.hashtags?.length > 0 ? (
                      <div className="publish-kit__tags-grid">
                        {reels.hashtags.map((tag, index) => (
                          <span key={index} className="publish-kit__tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="settings__empty">No se encontraron hashtags específicos de Reels.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Single YouTube view (horizontal) */}
              <div className="publish-kit__subcard">
                <h5 className="publish-kit__subtitle">Títulos sugeridos</h5>
                {metadata.titles.length > 0 ? (
                  <ul className="publish-kit__titles-list">
                    {metadata.titles.map((title, index) => (
                      <li key={index} className="publish-kit__title-item">
                        <span className="publish-kit__title-text">{title}</span>
                        <CopyButton text={title} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="settings__empty">No se encontraron títulos en los metadatos.</p>
                )}
              </div>

              <div className="publish-kit__subcard">
                <div className="publish-kit__subcard-header">
                  <h5 className="publish-kit__subtitle">Descripción</h5>
                  <CopyButton text={metadata.description} />
                </div>
                <textarea
                  className="publish-kit__textarea"
                  readOnly
                  rows={8}
                  value={metadata.description}
                />
              </div>

              <div className="publish-kit__subcard">
                <div className="publish-kit__subcard-header">
                  <h5 className="publish-kit__subtitle">
                    Etiquetas {metadata.tags.length > 0 && `(${metadata.tags.length})`}
                  </h5>
                  <CopyButton text={tagsString} label="Copiar etiquetas" />
                </div>

                {isTagsOverLimit && (
                  <p className="publish-kit__warning">
                    Las etiquetas superan los 500 caracteres que permite YouTube.
                  </p>
                )}

                {metadata.tags.length > 0 ? (
                  <div className="publish-kit__tags-grid">
                    {metadata.tags.map((tag, index) => (
                      <span key={index} className="publish-kit__tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="settings__empty">No se encontraron etiquetas en los metadatos.</p>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="settings__card">
          <h4 className="settings__card-title">Metadatos de publicación</h4>
          <p className="settings__empty">No encontré los metadatos en el chat del guion.</p>
        </div>
      )}
    </div>
  );
}
