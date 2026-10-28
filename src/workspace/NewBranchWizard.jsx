import { useEffect, useRef, useState } from 'react';
import ChoiceCards from '../ui/ChoiceCards.jsx';
import CustomSelect from '../ui/CustomSelect.jsx';
import VoicePreviewButton from '../voice/VoicePreviewButton.jsx';
import { slugify } from '../flow/parseCharacterSheets.js';
import {
  ORIENTATION_DESCRIPTIONS,
  VIDEO_TYPE_LABELS,
  VIDEO_TYPE_HINTS,
  MODE_LABELS,
  MODE_HINTS,
} from '../timeline/branchHelpers.js';

function ensureUniqueKeys(characters) {
  const used = new Set();
  return characters.map((char, idx) => {
    let base = slugify(char.name) || `personaje-${idx + 1}`;
    let key = base;
    let n = 2;
    while (used.has(key)) {
      key = `${base.slice(0, 55)}-${n}`;
      n++;
    }
    used.add(key);
    return { ...char, key };
  });
}

export function useBranchForm(branch, isOpen) {
  const [name, setName] = useState('');
  const [orientation, setOrientation] = useState('horizontal');
  const [videoType, setVideoType] = useState('explainer');
  const [characterMode, setCharacterMode] = useState('create');
  const [characters, setCharacters] = useState([]);
  const [pendingCharacters, setPendingCharacters] = useState([]);
  const [narratorVoiceId, setNarratorVoiceId] = useState('');
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
      setNarratorVoiceId(branch.narratorVoiceId || '');
      const loadedChars = Array.isArray(branch.characters) && branch.characters.length > 0
        ? branch.characters.map((c) => ({ ...c, voiceId: c.voiceId || null }))
        : Array.isArray(branch.characterImages) && branch.characterImages.length > 0
          ? branch.characterImages.map((file, idx) => ({
              key: `personaje-${idx + 1}`,
              name: `Personaje ${idx + 1}`,
              description: '',
              file,
              source: branch.characterMode === 'create' ? 'flow' : 'own',
              voiceId: null,
            }))
          : [];
      setCharacters(loadedChars);
      setMode(branch.mode || 'free');
    } else {
      setName('');
      setOrientation('horizontal');
      setVideoType('explainer');
      setCharacterMode('create');
      setCharacters([]);
      setNarratorVoiceId('');
      setMode('free');
    }
    setPendingCharacters([]);
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
    characters,
    setCharacters,
    pendingCharacters,
    setPendingCharacters,
    narratorVoiceId,
    setNarratorVoiceId,
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
    characters,
    setCharacters,
    pendingCharacters,
    setPendingCharacters,
    narratorVoiceId,
    setNarratorVoiceId,
    mode,
    setMode,
    isBusy,
    setIsBusy,
    error,
    setError,
  } = useBranchForm(branch, isOpen);

  const [savedVoices, setSavedVoices] = useState([]);
  useEffect(() => {
    if (!isOpen || !window.electronAPI?.listSavedVoices) return;
    window.electronAPI.listSavedVoices().then((list) => setSavedVoices(list || [])).catch(() => {});
  }, [isOpen]);

  const narratorVoiceOptions = [
    { value: '', label: 'Predeterminada global' },
    ...savedVoices.map((v) => ({ value: v.id, label: v.label || v.name })),
  ];

  const characterVoiceOptions = [
    { value: '', label: 'Sin voz (solo narración)' },
    ...savedVoices.map((v) => ({ value: v.id, label: v.label || v.name })),
  ];

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

  const totalCharactersCount = characters.length + pendingCharacters.length;

  const handleSelectFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 10 - totalCharactersCount;
    if (remainingSlots <= 0) {
      setError('Se alcanzó el límite máximo de 10 personajes.');
      return;
    }

    const currentTotal = characters.length + pendingCharacters.length;
    const allowed = files.slice(0, remainingSlots).map((file, i) => ({
      id: crypto.randomUUID(),
      name: `Personaje ${currentTotal + i + 1}`,
      description: '',
      fileName: file.name,
      path: file.path,
      previewUrl: URL.createObjectURL(file),
      voiceId: null,
    }));

    setPendingCharacters((prev) => [...prev, ...allowed]);
    e.target.value = '';
  };

  const handleUpdateExistingCharacter = (index, field, value) => {
    setCharacters((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleUpdatePendingCharacter = (index, field, value) => {
    setPendingCharacters((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveExistingCharacter = (index) => {
    setCharacters((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemovePendingCharacter = (index) => {
    setPendingCharacters((prev) => {
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

      let targetBranchId = branch?.id;

      if (!isEdit) {
        const created = await api.createBranch({
          name: cleanName,
          orientation,
          videoType,
          characterMode,
          characterImages: [],
          characters: [],
          narratorVoiceId: narratorVoiceId || null,
          mode,
        });
        targetBranchId = created.id;
      }

      let uploadedFileNames = [];
      if (pendingCharacters.length > 0) {
        const filePaths = pendingCharacters.map((f) => f.path).filter(Boolean);
        if (filePaths.length > 0) {
          uploadedFileNames = await api.addBranchCharacterImage({
            branchId: targetBranchId,
            filePaths,
          });
        }
      }

      const newCharsFromPending = pendingCharacters.map((p, idx) => ({
        key: slugify(p.name) || `personaje-${characters.length + idx + 1}`,
        name: p.name.trim() || `Personaje ${characters.length + idx + 1}`,
        description: p.description.trim(),
        file: uploadedFileNames[idx],
        source: 'own',
        voiceId: p.voiceId || null,
      }));

      const allChars = [
        ...characters.map((c, idx) => ({
          key: slugify(c.name) || c.key || `personaje-${idx + 1}`,
          name: c.name.trim() || `Personaje ${idx + 1}`,
          description: c.description ? c.description.trim() : '',
          file: c.file,
          source: c.source || 'own',
          voiceId: c.voiceId || null,
        })),
        ...newCharsFromPending,
      ];

      const finalCharacters = ensureUniqueKeys(allChars);
      const finalImages = finalCharacters.map((c) => c.file).filter(Boolean);

      let savedResult;
      if (isEdit) {
        savedResult = await api.updateBranch(branch.id, {
          name: cleanName,
          orientation,
          videoType,
          characterMode,
          characterImages: finalImages,
          characters: finalCharacters,
          narratorVoiceId: narratorVoiceId || null,
          mode,
        });
      } else {
        if (finalCharacters.length > 0) {
          savedResult = await api.updateBranch(targetBranchId, {
            characterImages: finalImages,
            characters: finalCharacters,
            narratorVoiceId: narratorVoiceId || null,
          });
        } else {
          savedResult = {
            id: targetBranchId,
            name: cleanName,
            orientation,
            videoType,
            characterMode,
            characterImages: [],
            characters: [],
            narratorVoiceId: narratorVoiceId || null,
            mode,
          };
        }
      }

      onSaved?.(savedResult);
      onClose();
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

            {(characterMode === 'own' || (isEdit && (characters.length > 0 || pendingCharacters.length > 0))) && (
              <div className="branch-wizard__character-section">
                <div className="branch-wizard__character-header">
                  <span className="branch-wizard__character-title">
                    Personajes de la rama ({totalCharactersCount}/10)
                  </span>
                  <button
                    type="button"
                    className="settings__button settings__button--ghost"
                    disabled={isBusy || totalCharactersCount >= 10}
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

                {totalCharactersCount === 0 ? (
                  <p className="branch-wizard__empty-hint">
                    No has añadido imágenes. Puedes subir hasta 10 personajes con su imagen (PNG, JPG, WebP).
                  </p>
                ) : (
                  <div className="branch-wizard__images-grid">
                    {/* Existing stored characters */}
                    {characters.map((char, idx) => (
                      <div key={char.file || idx} className="branch-wizard__character-card">
                        <div className="branch-wizard__card-thumb">
                          <img
                            src={`mecatube-media://branch-character/${branch?.id}/${encodeURIComponent(char.file)}`}
                            alt={char.name}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <button
                            type="button"
                            className="branch-wizard__image-remove"
                            title="Eliminar personaje"
                            disabled={isBusy}
                            onClick={() => handleRemoveExistingCharacter(idx)}
                          >
                            ✕
                          </button>
                        </div>
                        <input
                          type="text"
                          className="branch-wizard__char-input"
                          placeholder="Nombre del personaje"
                          maxLength={80}
                          value={char.name}
                          disabled={isBusy}
                          onChange={(e) => handleUpdateExistingCharacter(idx, 'name', e.target.value)}
                        />
                        <input
                          type="text"
                          className="branch-wizard__char-input"
                          placeholder="Descripción (opcional)"
                          maxLength={2000}
                          value={char.description || ''}
                          disabled={isBusy}
                          onChange={(e) => handleUpdateExistingCharacter(idx, 'description', e.target.value)}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', marginTop: '4px' }}>
                          <CustomSelect
                            value={char.voiceId || ''}
                            options={characterVoiceOptions}
                            placeholder="Sin voz (solo narración)"
                            ariaLabel={`Voz para ${char.name || 'personaje'}`}
                            disabled={isBusy}
                            onChange={(val) => handleUpdateExistingCharacter(idx, 'voiceId', val || null)}
                            style={{ flex: 1, fontSize: '0.8rem' }}
                          />
                          <VoicePreviewButton voiceId={char.voiceId} />
                        </div>
                      </div>
                    ))}

                    {/* Pending added characters */}
                    {pendingCharacters.map((file, idx) => (
                      <div key={file.id || idx} className="branch-wizard__character-card">
                        <div className="branch-wizard__card-thumb">
                          <img src={file.previewUrl} alt={file.name} />
                          <button
                            type="button"
                            className="branch-wizard__image-remove"
                            title="Eliminar personaje"
                            disabled={isBusy}
                            onClick={() => handleRemovePendingCharacter(idx)}
                          >
                            ✕
                          </button>
                        </div>
                        <input
                          type="text"
                          className="branch-wizard__char-input"
                          placeholder="Nombre del personaje"
                          maxLength={80}
                          value={file.name}
                          disabled={isBusy}
                          onChange={(e) => handleUpdatePendingCharacter(idx, 'name', e.target.value)}
                        />
                        <input
                          type="text"
                          className="branch-wizard__char-input"
                          placeholder="Descripción (opcional)"
                          maxLength={2000}
                          value={file.description || ''}
                          disabled={isBusy}
                          onChange={(e) => handleUpdatePendingCharacter(idx, 'description', e.target.value)}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', marginTop: '4px' }}>
                          <CustomSelect
                            value={file.voiceId || ''}
                            options={characterVoiceOptions}
                            placeholder="Sin voz (solo narración)"
                            ariaLabel={`Voz para ${file.name || 'personaje'}`}
                            disabled={isBusy}
                            onChange={(val) => handleUpdatePendingCharacter(idx, 'voiceId', val || null)}
                            style={{ flex: 1, fontSize: '0.8rem' }}
                          />
                          <VoicePreviewButton voiceId={file.voiceId} />
                        </div>
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

          {/* Section 6: Voz de narración */}
          <div className="workspace-modal__field">
            <label className="workspace-modal__label">Voz del narrador (opcional)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CustomSelect
                value={narratorVoiceId || ''}
                options={narratorVoiceOptions}
                placeholder="Predeterminada global"
                ariaLabel="Voz del narrador de la rama"
                disabled={isBusy}
                onChange={(val) => setNarratorVoiceId(val || '')}
                style={{ flex: 1 }}
              />
              <VoicePreviewButton voiceId={narratorVoiceId} />
            </div>
            <p className="branch-wizard__hint" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Se usará esta voz de Cartesia para las narraciones de los videos de esta rama.
            </p>
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
