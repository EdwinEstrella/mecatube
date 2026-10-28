import { useState } from 'react';
import StageTrack, { STATUS_LABELS } from './StageTrack.jsx';
import VoicePanel from '../voice/VoicePanel.jsx';
import CustomSelect from '../ui/CustomSelect.jsx';
import CharactersPanel from '../flow/CharactersPanel.jsx';
import AutoEditPanel from '../editor/AutoEditPanel.jsx';
import PublishKit from './PublishKit.jsx';
import { getRememberedStageKey, rememberStageKey } from './stageMemory.js';
import IdeaStagePanel from './IdeaStagePanel.jsx';
import ScriptStagePanel from './ScriptStagePanel.jsx';
import { latestIdeas, latestScript } from './stageContent.js';
import { syncChosenIdea } from './syncChosenIdea.js';

const ILLUSTRATOR_HINTS = {
  images: 'Las imágenes de las escenas se generan desde el chat del ilustrador.',
  animations: 'Las animaciones se generan desde el chat del ilustrador.',
  thumbnail: 'La miniatura se genera desde el chat del ilustrador.',
};

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
  branch = null,
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
  onEditBranch,
  onBranchUpdated,
  onOpenBranchPanel,
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  const [prevVideoId, setPrevVideoId] = useState(video.id);
  const [selectedKey, setSelectedKey] = useState(() => getRememberedStageKey(video.id, stages));
  const orientation = branch?.orientation ?? video?.orientation ?? 'horizontal';

  if (video.id !== prevVideoId) {
    setPrevVideoId(video.id);
    setSelectedKey(getRememberedStageKey(video.id, stages));
  }

  const selectedStage = stages.find((stage) => stage.key === selectedKey) ?? stages[0] ?? null;

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

  const handleSendIdea = async (idea) => {
    await window.electronAPI.sendChatMessage({
      conversationId: video.scriptConversationId,
      text: String(idea.number),
    });
    await syncChosenIdea(window.electronAPI, video.scriptConversationId, idea);
    setSelectedKey('script');
    rememberStageKey(video.id, 'script');
    onEdited?.();
  };

  return (
    <div className="video-detail">
      <div className="video-detail__header-bar">
        {branch && onOpenBranchPanel && (
          <button
            type="button"
            className="settings__button settings__button--ghost video-detail__branch-btn"
            onClick={() => onOpenBranchPanel(branch.id)}
            title="Ver panel de la rama"
          >
            ← Rama: {branch.name}
          </button>
        )}
        <span className="video-detail__completed-counter">
          {doneCount}/{stages.length} etapas completadas
        </span>
      </div>

      <div className="video-detail__track-wrapper">
        <StageTrack
          stages={stages}
          selectedKey={selectedStage?.key}
          onSelect={(stage) => {
            setSelectedKey(stage.key);
            rememberStageKey(video.id, stage.key);
          }}
        />
      </div>

      {selectedStage && (
        <section
          className={`video-detail__stage-section ${
            selectedStage.key === 'editing' ? 'video-detail__stage-section--editing' : ''
          }`}
        >
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

          {selectedStage.key === 'idea' && (
            <IdeaStagePanel
              key={video.id}
              hasLinkedChat={Boolean(video.scriptConversationId)}
              ideasData={latestIdeas(scriptMessages)}
              onSendIdea={handleSendIdea}
            />
          )}

          {selectedStage.key === 'script' && (
            <ScriptStagePanel
              scriptText={latestScript(scriptMessages)}
              hasChosenIdea={Boolean(video.ideaNumber || latestIdeas(scriptMessages)?.chosenNumber != null)}
            />
          )}

          {selectedStage.key === 'voice' && (
            selectedStage.status === 'not-needed' ? (
              <p className="video-detail__stage-hint">
                Este video usa la voz de los personajes en Flow; no lleva voz en off.
              </p>
            ) : (
              <VoicePanel
                video={video}
                branch={branch}
                scriptMessages={scriptMessages}
                voice={voice}
                onSaveNarration={onSaveNarration}
              />
            )
          )}

          {selectedStage.key === 'characters' && (
            selectedStage.status === 'not-needed' ? (
              <p className="video-detail__stage-hint">
                Esta etapa no es requerida para videos de tipo lista (sin personajes principales).
              </p>
            ) : (
              <CharactersPanel
                video={video}
                branch={branch}
                characters={characters}
                onSetProject={onSetFlowProject}
                onOpenProject={onOpenFlowProject}
                onEditBranch={onEditBranch}
                onBranchUpdated={onBranchUpdated}
              />
            )
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
            <PublishKit
              video={video}
              scriptMessages={scriptMessages}
              orientation={branch?.orientation ?? video?.orientation ?? 'horizontal'}
            />
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

      <div className="saved-idea__actions video-detail__reset-actions">
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
