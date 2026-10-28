import { useEffect, useRef, useState } from 'react';
import { characterImageUrl, branchCharacterImageUrl } from './characterStatus.js';
import CustomSelect from '../ui/CustomSelect.jsx';
import VoicePreviewButton from '../voice/VoicePreviewButton.jsx';

// Presentational Timeline section: selected image per character plus the editable Flow project link
export default function CharactersPanel({
  video,
  characters = [],
  branch = null,
  onSetProject,
  onOpenProject,
  onEditBranch,
  onBranchUpdated,
}) {
  const branchCharacters = Array.isArray(branch?.characters) && branch.characters.length > 0
    ? branch.characters
    : branch?.characterMode === 'own' && Array.isArray(branch?.characterImages) && branch.characterImages.length > 0
      ? branch.characterImages.map((file, idx) => ({
          key: `personaje-${idx + 1}`,
          name: `Personaje ${idx + 1}`,
          description: '',
          file,
          source: 'own',
        }))
      : [];

  const branchHasCharacters = branchCharacters.length > 0;
  const stored = (branchHasCharacters ? branch?.flowProjectUrl : null) ?? video.flowProjectUrl ?? '';
  const [draft, setDraft] = useState(stored);
  const [editedFrom, setEditedFrom] = useState(stored);
  const [toastMessage, setToastMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const autoSavedRef = useRef(false);

  // Follow the stored value (e.g. set automatically after a generation) unless the user is typing
  if (editedFrom !== stored) {
    setEditedFrom(stored);
    setDraft(stored);
  }

  const changed = draft.trim() !== stored;
  const allHaveSelected = characters.length > 0 && characters.every((c) => Boolean(c.selectedFile));

  const [savedVoices, setSavedVoices] = useState([]);
  useEffect(() => {
    if (!window.electronAPI?.listSavedVoices) return;
    window.electronAPI.listSavedVoices().then((list) => setSavedVoices(list || [])).catch(() => {});
  }, []);

  const narratorVoiceOptions = [
    { value: '', label: 'Predeterminada global' },
    ...savedVoices.map((v) => ({ value: v.id, label: v.label || v.name })),
  ];

  const characterVoiceOptions = [
    { value: '', label: 'Sin voz (solo narración)' },
    ...savedVoices.map((v) => ({ value: v.id, label: v.label || v.name })),
  ];

  const handleNarratorVoiceChange = async (val) => {
    if (!branch?.id || !window.electronAPI?.updateBranch) return;
    try {
      await window.electronAPI.updateBranch(branch.id, { narratorVoiceId: val || null });
      onBranchUpdated?.();
    } catch {}
  };

  const handleCharacterVoiceChange = async (charKey, val) => {
    if (!branch?.id || !window.electronAPI?.updateBranch) return;
    try {
      const updated = branchCharacters.map((c) =>
        c.key === charKey ? { ...c, voiceId: val || null } : c
      );
      await window.electronAPI.updateBranch(branch.id, { characters: updated });
      onBranchUpdated?.();
    } catch {}
  };

  const handleSaveToBranch = async () => {
    if (!branch?.id || !video?.id || !window.electronAPI) return;
    setIsSaving(true);
    try {
      await window.electronAPI.saveBranchCharactersFromVideo(branch.id, video.id);
      setToastMessage('Personajes guardados en la rama');
      onBranchUpdated?.();
    } catch (err) {
      setToastMessage(`Error: ${err.message || 'No se pudo guardar en la rama'}`);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (
      !branchHasCharacters &&
      allHaveSelected &&
      !autoSavedRef.current &&
      branch?.id &&
      branch?.characterMode === 'create'
    ) {
      autoSavedRef.current = true;
      handleSaveToBranch();
    }
  }, [allHaveSelected, branchHasCharacters, branch?.id, branch?.characterMode]);

  if (branchHasCharacters) {
    return (
      <div className="char-panel">
        <div className="char-panel__header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 className="char-panel__title">Personajes</h4>
          <span className="char-panel__note" style={{ color: 'var(--color-text-dim, #999)', fontSize: '0.85rem' }}>
            Personajes de la rama «{branch.name}»
          </span>
          <button
            type="button"
            className="settings__button settings__button--ghost"
            style={{ fontSize: '0.8rem' }}
            onClick={() => onEditBranch?.(branch)}
          >
            Editar en la rama
          </button>
        </div>

        {stored && (
          <div className="char-panel__project">
            <span className="settings__card-text" style={{ fontSize: '0.8rem' }}>
              Proyecto de Flow: {stored}
            </span>
            <button
              type="button"
              className="settings__button settings__button--ghost"
              onClick={() => onOpenProject(video.id)}
            >
              Abrir en Flow
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Voz de narración:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CustomSelect
              value={branch?.narratorVoiceId || ''}
              options={narratorVoiceOptions}
              placeholder="Predeterminada global"
              ariaLabel="Voz de narración de la rama"
              onChange={handleNarratorVoiceChange}
              style={{ minWidth: '180px', fontSize: '0.8rem' }}
            />
            <VoicePreviewButton voiceId={branch?.narratorVoiceId} />
          </div>
        </div>

        <ul className="char-panel__list">
          {branchCharacters.map((char) => (
            <li key={char.key || char.file} className="char-panel__item">
              {char.file ? (
                <img
                  className="char-panel__image"
                  src={branchCharacterImageUrl(branch.id, char.file)}
                  alt={char.name}
                  loading="lazy"
                />
              ) : (
                <div className="char-panel__image char-panel__image--empty">Sin imagen</div>
              )}
              <span className="char-panel__name">{char.name}</span>
              {char.description ? (
                <span className="char-panel__state" title={char.description} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {char.description}
                </span>
              ) : (
                <span className="char-panel__state">Rama</span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', width: '100%' }}>
                <CustomSelect
                  value={char.voiceId || ''}
                  options={characterVoiceOptions}
                  placeholder="Sin voz (solo narración)"
                  ariaLabel={`Voz para ${char.name}`}
                  onChange={(val) => handleCharacterVoiceChange(char.key, val)}
                  style={{ flex: 1, fontSize: '0.8rem' }}
                />
                <VoicePreviewButton voiceId={char.voiceId} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="char-panel">
      <h4 className="char-panel__title">Personajes</h4>

      <div className="char-panel__project">
        <input
          className="chat-list__rename char-panel__input"
          value={draft}
          placeholder="https://flow.google.com/u/…/project/…"
          aria-label="URL del proyecto de Flow"
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="button"
          className="settings__button settings__button--primary"
          disabled={!changed}
          onClick={() => onSetProject(video.id, draft.trim())}
        >
          Guardar
        </button>
        {stored && (
          <button
            type="button"
            className="settings__button settings__button--ghost"
            onClick={() => onOpenProject(video.id)}
          >
            Abrir en Flow
          </button>
        )}
      </div>

      {characters.length === 0 ? (
        <p className="settings__card-text">Aún no hay personajes. Genéralos desde el chat del ilustrador.</p>
      ) : (
        <>
          <ul className="char-panel__list">
            {characters.map((character) => (
              <li key={character.key} className="char-panel__item">
                {character.selectedFile ? (
                  <img
                    className="char-panel__image"
                    src={characterImageUrl(video.id, character.key, character.selectedFile)}
                    alt={character.name}
                    loading="lazy"
                  />
                ) : (
                  <div className="char-panel__image char-panel__image--empty">Sin imagen</div>
                )}
                <span className="char-panel__name">{character.name}</span>
                <span className="char-panel__state">
                  {character.approved ? 'Aprobado' : character.selectedFile ? 'Seleccionado' : 'Pendiente'}
                </span>
              </li>
            ))}
          </ul>

          {allHaveSelected && branch?.id && (
            <div className="char-panel__actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                className="settings__button settings__button--primary"
                disabled={isSaving}
                onClick={handleSaveToBranch}
              >
                Guardar como personajes de la rama
              </button>
              {toastMessage && (
                <span className="char-panel__toast" style={{ color: '#4caf50', fontSize: '0.85rem' }}>
                  {toastMessage}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
