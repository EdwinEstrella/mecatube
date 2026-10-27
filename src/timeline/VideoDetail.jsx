import { useRef, useState } from 'react';
import StageTrack, { STATUS_LABELS } from './StageTrack.jsx';
import VoicePanel from '../voice/VoicePanel.jsx';
import CustomSelect from '../ui/CustomSelect.jsx';
import CharactersPanel from '../flow/CharactersPanel.jsx';
import AutoEditPanel from '../editor/AutoEditPanel.jsx';

const ILLUSTRATOR_HINTS = {
  images: 'Las imágenes de las escenas se generan desde el chat del ilustrador.',
  animations: 'Las animaciones se generan desde el chat del ilustrador.',
  thumbnail: 'La miniatura se genera desde el chat del ilustrador.',
};

function getInitialStageKey(stageList) {
  const notDone = stageList.find((stage) => stage.status !== 'done');
  return notDone?.key ?? stageList[stageList.length - 1]?.key ?? null;
}

// state: 'ok' | 'deleted' | 'none' for one linked chat
function ChatLink({ label, linkedId, state, conversations, onChange, onOpen, onStart, openLabel, startLabel }) {
  const options = [
    { value: '', label: 'Sin vincular' },
    ...(state === 'deleted' ? [{ value: linkedId, label: 'Chat eliminado' }] : []),
    ...conversations.map((conversation) => ({ value: conversation.id, label: conversation.title })),
  ];

  return (
    <div className="video-detail__chat">
      <span className="video-detail__chat-label">{label}</span>
      <CustomSelect
        value={linkedId ?? ''}
        options={options}
        ariaLabel={`Chat de ${label}`}
        onChange={(val) => onChange(val || null)}
      />
      {state === 'ok' && (
        <button type="button" className="settings__button settings__button--ghost" onClick={() => onOpen(linkedId)}>
          {openLabel}
        </button>
      )}
      {state === 'deleted' && <span className="video-detail__note">chat eliminado</span>}
      <button type="button" className="settings__button settings__button--primary" onClick={onStart}>
        {startLabel}
      </button>
    </div>
  );
}

// Presentational: 1 single timeline for the workspace
export default function VideoDetail({
  video,
  stages = [],
  doneCount = 0,
  chatStates,
  conversations,
  scriptMessages,
  voice,
  characters = [],
  onSendPrompt1,
  onSetFlowProject,
  onOpenFlowProject,
  onSaveNarration,
  onRename,
  onLink,
  onOpenChat,
  onStartPrompt,
  onToggleStage,
  onDelete,
  onEdited,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const settledRef = useRef(false);

  const [prevVideoId, setPrevVideoId] = useState(video.id);
  const [selectedKey, setSelectedKey] = useState(() => getInitialStageKey(stages));

  if (video.id !== prevVideoId) {
    setPrevVideoId(video.id);
    setSelectedKey(getInitialStageKey(stages));
  }

  const selectedStage = stages.find((stage) => stage.key === selectedKey) ?? stages[0] ?? null;

  const startEditing = () => {
    settledRef.current = false;
    setDraft(video.title);
    setIsEditing(true);
  };

  const finishEditing = (save) => {
    if (settledRef.current) return;
    settledRef.current = true;
    setIsEditing(false);
    const title = draft.trim();
    if (save && title && title !== video.title) onRename(video.id, title);
  };

  const override = selectedStage ? video.overrides?.[selectedStage.key] : undefined;
  let currentStatusText = '';
  let nextActionLabel = 'Marcar como completada';

  if (selectedStage) {
    if (override === true) {
      currentStatusText = 'Completada (manual)';
      nextActionLabel = 'Marcar como pendiente';
    } else if (override === false) {
      currentStatusText = 'Pendiente (manual)';
      nextActionLabel = 'Volver a automático';
    } else {
      const statusLabel = STATUS_LABELS[selectedStage.status] ?? selectedStage.status;
      currentStatusText = `Automático (${statusLabel})`;
      nextActionLabel = 'Marcar como completada';
    }
  }

  return (
    <div className="video-detail" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          {isEditing ? (
            <input
              className="chat-list__rename video-detail__rename"
              style={{ fontSize: '1.4rem', fontWeight: 600, padding: '4px 8px' }}
              value={draft}
              maxLength={120}
              autoFocus
              aria-label="Título del video"
              onFocus={(event) => event.target.select()}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => finishEditing(true)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') finishEditing(true);
                else if (event.key === 'Escape') finishEditing(false);
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
              <h1 className="settings__title" style={{ margin: 0, fontSize: '1.6rem' }}>
                {video.title}
              </h1>
              <button
                type="button"
                className="chat-list__rename-button video-detail__edit"
                aria-label="Renombrar video"
                title="Renombrar video"
                onClick={startEditing}
              >
                ✎
              </button>
              <span className="settings__card-text" style={{ fontSize: '0.82rem', opacity: 0.65 }}>
                {doneCount}/{stages.length} etapas completadas
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          className="settings__button settings__button--primary"
          onClick={onSendPrompt1}
        >
          Enviar Prompt 1
        </button>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <StageTrack
          stages={stages}
          selectedKey={selectedStage?.key}
          onSelect={(stage) => setSelectedKey(stage.key)}
        />
      </div>

      {selectedStage && (
        <section className="video-detail__stage-section">
          <h2 className="video-detail__stage-heading">{selectedStage.label}</h2>

          {(selectedStage.key === 'idea' || selectedStage.key === 'script' || selectedStage.key === 'metadata') && (
            <ChatLink
              label="Guion"
              linkedId={video.scriptConversationId}
              state={chatStates.script}
              conversations={conversations}
              onChange={(id) => onLink(video.id, 'scriptConversationId', id)}
              onOpen={onOpenChat}
              onStart={() => onStartPrompt(video.id, 'script')}
              openLabel="Abrir chat del guion"
              startLabel="Enviar Prompt 1"
            />
          )}

          {selectedStage.key === 'voice' && (
            <VoicePanel
              video={video}
              scriptMessages={scriptMessages}
              voice={voice}
              onSaveNarration={onSaveNarration}
            />
          )}

          {selectedStage.key === 'characters' && (
            <CharactersPanel
              video={video}
              characters={characters}
              onSetProject={onSetFlowProject}
              onOpenProject={onOpenFlowProject}
            />
          )}

          {(selectedStage.key === 'images' || selectedStage.key === 'animations' || selectedStage.key === 'thumbnail') && (
            <>
              <ChatLink
                label="Ilustrador"
                linkedId={video.illustratorConversationId}
                state={chatStates.illustrator}
                conversations={conversations}
                onChange={(id) => onLink(video.id, 'illustratorConversationId', id)}
                onOpen={onOpenChat}
                onStart={() => onStartPrompt(video.id, 'illustrator')}
                openLabel="Abrir chat del ilustrador"
                startLabel="Enviar Prompt 2"
              />
              <p className="video-detail__stage-hint">{ILLUSTRATOR_HINTS[selectedStage.key]}</p>
            </>
          )}

          {selectedStage.key === 'editing' && (
            <AutoEditPanel videoId={video.id} stages={stages} onEdited={onEdited} />
          )}

          {selectedStage.key === 'published' && (
            <p className="video-detail__stage-hint">
              Marca esta etapa cuando el video esté publicado en YouTube.
            </p>
          )}

          <div className="video-detail__status-control">
            <span className="video-detail__status-label">
              Estado: <strong>{currentStatusText}</strong>
            </span>
            <button
              type="button"
              className="settings__button settings__button--ghost"
              onClick={() => onToggleStage(video, selectedStage)}
            >
              {nextActionLabel}
            </button>
          </div>
        </section>
      )}

      <div className="saved-idea__actions" style={{ marginTop: '16px' }}>
        {isConfirming ? (
          <>
            <button type="button" className="settings__button settings__button--danger" onClick={() => onDelete(video.id)}>
              Confirmar reinicio
            </button>
            <button type="button" className="settings__button settings__button--ghost" onClick={() => setIsConfirming(false)}>
              Cancelar
            </button>
          </>
        ) : (
          <button type="button" className="settings__button settings__button--danger" onClick={() => setIsConfirming(true)}>
            Reiniciar línea de tiempo
          </button>
        )}
      </div>
    </div>
  );
}
