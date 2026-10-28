import { useEffect, useRef, useState } from 'react';
import ChoiceCards from '../ui/ChoiceCards.jsx';
import {
  ORIENTATION_DESCRIPTIONS,
  VIDEO_TYPE_LABELS,
  VIDEO_TYPE_HINTS,
  MODE_LABELS,
  MODE_HINTS,
} from '../timeline/branchHelpers.js';

export function useBranchForm(branch, isOpen) {
  const [name, setName] = useState('');
  const [orientation, setOrientation] = useState('horizontal');
  const [videoType, setVideoType] = useState('explainer');
  const [characterMode, setCharacterMode] = useState('create');
  const [characterImages, setCharacterImages] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [mode, setMode] = useState('free');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (branch) {
      setName(branch.name || '');
      setOrientation(branch.orientation || 'horizontal');
      setVideoType(branch.videoType || 'explainer');
      setCharacterMode(branch.characterMode || 'create');
      setCharacterImages(branch.characterImages || []);
      setMode(branch.mode || 'free');
    } else {
      setName('');
      setOrientation('horizontal');
      setVideoType('explainer');
      setCharacterMode('create');
      setCharacterImages([]);
      setMode('free');
    }
    setPendingFiles([]);
    setIsBusy(false);
    setError('');
  }, [branch, isOpen]);

  return {
    name,
    setName,
    orientation,
    setOrientation,
    videoType,
    setVideoType,
    characterMode,
    setCharacterMode,
    characterImages,
    setCharacterImages,
    pendingFiles,
    setPendingFiles,
    mode,
    setMode,
    isBusy,
    setIsBusy,
    error,
    setError,
  };
}

/**
 * Aspect ratio rectangle icon
 */
function AspectRatioIcon({ ratio = '16:9' }) {
  const isHorizontal = ratio === '16:9';
  return (
    <div
      className={`branch-ratio-icon branch-ratio-icon--${isHorizontal ? 'horizontal' : 'vertical'}`}
      aria-hidden="true"
    >
      <span className="branch-ratio-icon__text">{ratio}</span>
    </div>
  );
}

export default function NewBranchWizard({
  isOpen,
  onClose,
  branch = null,
  onSaved,
}) {
  const isEdit = Boolean(branch?.id);
  const fileInputRef = useRef(null);

  const {
    name,
    setName,
    orientation,
    setOrientation,
    videoType,
    setVideoType,
    characterMode,
    setCharacterMode,
    characterImages,
    setCharacterImages,
    pendingFiles,
    setPendingFiles,
    mode,
    setMode,
    isBusy,
    setIsBusy,
    error,
    setError,
  } = useBranchForm(branch, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isBusy) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isBusy, onClose]);

  if (!isOpen) return null;

  const totalImagesCount = characterImages.length + pendingFiles.length;

  const handleSelectFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 10 - totalImagesCount;
    if (remainingSlots <= 0) {
      setError('Se alcanzó el límite máximo de 10 imágenes.');
      return;
    }

    const allowed = files.slice(0, remainingSlots).map((file) => ({
      name: file.name,
      path: file.path,
      previewUrl: URL.createObjectURL(file),
    }));

    setPendingFiles((prev) => [...prev, ...allowed]);
    e.target.value = '';
  };

  const handleRemoveExistingImage = (imageName) => {
    setCharacterImages((prev) => prev.filter((img) => img !== imageName));
  };

  const handleRemovePendingFile = (index) => {
    setPendingFiles((prev) => {
      const copy = [...prev];
      const removed = copy.splice(index, 1)[0];
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return copy;
    });
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('El nombre de la rama es obligatorio.');
      return;
    }
    if (cleanName.length > 80) {
      setError('El nombre de la rama no puede superar los 80 caracteres.');
      return;
    }

    setIsBusy(true);
    setError('');

    try {
      const api = window.electronAPI;
      if (!api) throw new Error('API no disponible.');

      if (isEdit) {
        // Edit existing branch
        let finalImages = [...characterImages];
        if (pendingFiles.length > 0) {
          const filePaths = pendingFiles.map((f) => f.path).filter(Boolean);
          if (filePaths.length > 0) {
            const added = await api.addBranchCharacterImage({
              branchId: branch.id,
              filePaths,
            });
            finalImages = [...finalImages, ...added];
          }
        }

        const updated = await api.updateBranch(branch.id, {
          name: cleanName,
          orientation,
          videoType,
          characterMode,
          characterImages: characterMode === 'own' ? finalImages : [],
          mode,
        });
        onSaved?.(updated);
        onClose();
      } else {
        // Create new branch
        const created = await api.createBranch({
          name: cleanName,
          orientation,
          videoType,
          characterMode,
          characterImages: [],
          mode,
        });

        if (characterMode === 'own' && pendingFiles.length > 0) {
          const filePaths = pendingFiles.map((f) => f.path).filter(Boolean);
          if (filePaths.length > 0) {
            const storedNames = await api.addBranchCharacterImage({
              branchId: created.id,
              filePaths,
            });
            await api.updateBranch(created.id, {
              characterImages: storedNames,
            });
            created.characterImages = storedNames;
          }
        }

        onSaved?.(created);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Error guardando la rama.');
      setIsBusy(false);
    }
  };

  const orientationOptions = [
    {
      id: 'horizontal',
      label: 'Horizontal 16:9 · YouTube',
      icon: <AspectRatioIcon ratio="16:9" />,
      description: ORIENTATION_DESCRIPTIONS.horizontal,
    },
    {
      id: 'vertical',
      label: 'Vertical 9:16 · Shorts, TikTok, Reels',
      icon: <AspectRatioIcon ratio="9:16" />,
      description: ORIENTATION_DESCRIPTIONS.vertical,
    },
  ];

  const videoTypeOptions = [
    {
      id: 'explainer',
      label: VIDEO_TYPE_LABELS.explainer,
      hint: VIDEO_TYPE_HINTS.explainer,
    },
    {
      id: 'story',
      label: VIDEO_TYPE_LABELS.story,
      hint: VIDEO_TYPE_HINTS.story,
    },
    {
      id: 'list',
      label: VIDEO_TYPE_LABELS.list,
      hint: VIDEO_TYPE_HINTS.list,
    },
    {
      id: 'horror',
      label: VIDEO_TYPE_LABELS.horror,
      hint: VIDEO_TYPE_HINTS.horror,
    },
  ];

  const characterModeOptions = [
    {
      id: 'create',
      label: 'Crear personaje',
      hint: 'Se creará automáticamente en la primera ilustración',
    },
    {
      id: 'own',
      label: 'Ya tengo mi personaje',
      hint: 'Sube imágenes de tu personaje para usarlas directamente',
    },
  ];

  const modeOptions = [
    {
      id: 'free',
      label: MODE_LABELS.free,
      hint: MODE_HINTS.free,
    },
    {
      id: 'series',
      label: MODE_LABELS.series,
      hint: MODE_HINTS.series,
    },
    {
      id: 'titles',
      label: 'Banco de títulos',
      hint: MODE_HINTS.titles,
    },
  ];

  return (
    <div
      className="workspace-modal branch-wizard"
      role="dialog"
      aria-modal="true"
      aria-labelledby="branch-wizard-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
    >
      <div className="workspace-modal__card branch-wizard__card">
        <div className="workspace-modal__header">
          <h2 id="branch-wizard-title" className="workspace-modal__title">
            {isEdit ? 'Editar Rama' : 'Nueva Rama'}
          </h2>
          <p className="workspace-modal__description">
            {isEdit
              ? 'Modifica las opciones de formato, estilo narrativo y personaje de esta rama.'
              : 'Configura una rama para agrupar videos con un mismo formato, tipo y personaje.'}
          </p>
        </div>

        {error && <div className="workspace-modal__error">{error}</div>}

        <form className="workspace-modal__form" onSubmit={handleSubmit}>
          {/* Section 1: Nombre de la rama */}
          <div className="workspace-modal__field">
            <label htmlFor="branch-name" className="workspace-modal__label">
              1. Nombre de la rama
            </label>
            <input
              id="branch-name"
              type="text"
              className="workspace-modal__input"
              placeholder="Ej: Canal Principal, Serie Misterios, Shorts..."
              maxLength={80}
              value={name}
              disabled={isBusy}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
            <span className="branch-wizard__counter">{name.length}/80</span>
          </div>

          {/* Section 2: Formato */}
          <div className="workspace-modal__field">
            <label className="workspace-modal__label">2. Formato</label>
            <ChoiceCards
              options={orientationOptions}
              value={orientation}
              onChange={setOrientation}
              disabled={isBusy}
              columns={2}
              ariaLabel="Formato de la rama"
            />
          </div>

          {/* Section 3: Tipo de video */}
          <div className="workspace-modal__field">
            <label className="workspace-modal__label">3. Tipo de video</label>
            <ChoiceCards
              options={videoTypeOptions}
              value={videoType}
              onChange={setVideoType}
              disabled={isBusy}
              columns={2}
              ariaLabel="Tipo de video"
            />
          </div>

          {/* Section 4: Personaje */}
          <div className="workspace-modal__field">
            <label className="workspace-modal__label">4. Personaje</label>
            <ChoiceCards
              options={characterModeOptions}
              value={characterMode}
              onChange={setCharacterMode}
              disabled={isBusy}
              columns={2}
              ariaLabel="Modo de personaje"
            />

            {characterMode === 'own' && videoType === 'list' && (
              <p className="branch-wizard__warning-hint">
                Nota: Los videos de tipo Top / lista habitualmente no usan personajes.
              </p>
            )}

            {characterMode === 'own' && (
              <div className="branch-wizard__character-section">
                <div className="branch-wizard__character-header">
                  <span className="branch-wizard__character-title">
                    Imágenes del personaje ({totalImagesCount}/10)
                  </span>
                  <button
                    type="button"
                    className="settings__button settings__button--ghost"
                    disabled={isBusy || totalImagesCount >= 10}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    + Subir imágenes
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".png,.jpg,.jpeg,.webp"
                    style={{ display: 'none' }}
                    onChange={handleSelectFiles}
                  />
                </div>

                {totalImagesCount === 0 ? (
                  <p className="branch-wizard__empty-hint">
                    No has añadido imágenes. Puedes subir hasta 10 imágenes (PNG, JPG, WebP).
                  </p>
                ) : (
                  <div className="branch-wizard__images-grid">
                    {/* Existing stored images */}
                    {characterImages.map((imageName) => (
                      <div key={imageName} className="branch-wizard__image-thumb">
                        <img
                          src={`mecatube-media://branch-character/${branch?.id}/${encodeURIComponent(imageName)}`}
                          alt={imageName}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <span className="branch-wizard__image-name" title={imageName}>
                          {imageName}
                        </span>
                        <button
                          type="button"
                          className="branch-wizard__image-remove"
                          title="Eliminar imagen"
                          disabled={isBusy}
                          onClick={() => handleRemoveExistingImage(imageName)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    {/* Pending added files */}
                    {pendingFiles.map((file, idx) => (
                      <div key={file.name + idx} className="branch-wizard__image-thumb">
                        <img src={file.previewUrl} alt={file.name} />
                        <span className="branch-wizard__image-name" title={file.name}>
                          {file.name}
                        </span>
                        <button
                          type="button"
                          className="branch-wizard__image-remove"
                          title="Eliminar imagen"
                          disabled={isBusy}
                          onClick={() => handleRemovePendingFile(idx)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 5: Modo */}
          <div className="workspace-modal__field">
            <label className="workspace-modal__label">5. Modo de contenido</label>
            <ChoiceCards
              options={modeOptions}
              value={mode}
              onChange={setMode}
              disabled={isBusy}
              columns={3}
              ariaLabel="Modo de contenido"
            />
          </div>

          {/* Actions */}
          <div className="workspace-modal__actions">
            <button
              type="button"
              className="settings__button settings__button--ghost"
              disabled={isBusy}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="settings__button settings__button--primary"
              disabled={isBusy || !name.trim()}
            >
              {isBusy
                ? isEdit
                  ? 'Guardando...'
                  : 'Creando...'
                : isEdit
                  ? 'Guardar'
                  : 'Crear rama'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
