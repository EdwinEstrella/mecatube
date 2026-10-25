import { useRef, useState } from 'react';
import StageTrack from './StageTrack.jsx';
import VoicePanel from '../voice/VoicePanel.jsx';
import CustomSelect from '../ui/CustomSelect.jsx';
import CharactersPanel from '../flow/CharactersPanel.jsx';

// state: 'ok' | 'deleted' | 'none' for one linked chat
function ChatLink({ label, linkedId, state, conversations, onChange, onOpen, onStart, openLabel, startLabel }) {
  const options = [
    { value: '', label: 'Not linked' },
    ...(state === 'deleted' ? [{ value: linkedId, label: 'Chat deleted' }] : []),
    ...conversations.map((conversation) => ({ value: conversation.id, label: conversation.title })),
  ];

  return (
    <div className="video-detail__chat">
      <span className="video-detail__chat-label">{label}</span>
      <CustomSelect
        value={linkedId ?? ''}
        options={options}
        ariaLabel={`${label} chat`}
        onChange={(val) => onChange(val || null)}
      />
      {state === 'ok' && (
        <button type="button" className="settings__button settings__button--ghost" onClick={() => onOpen(linkedId)}>
          {openLabel}
        </button>
      )}
      {state === 'deleted' && <span className="video-detail__note">chat deleted</span>}
      <button type="button" className="settings__button settings__button--primary" onClick={onStart}>
        {startLabel}
      </button>
    </div>
  );
}

// Presentational: rename, chat links, per-stage overrides and delete for one video
export default function VideoDetail({
  video,
  stages,
  chatStates,
  conversations,
  scriptMessages,
  voice,
  characters = [],
  onSetFlowProject,
  onOpenFlowProject,
  onSaveNarration,
  onRename,
  onLink,
  onOpenChat,
  onStartPrompt,
  onToggleStage,
  onDelete,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  // Guards against saving twice when Enter unmounts the input and blur fires afterwards
  const settledRef = useRef(false);

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

  return (
    <div className="video-detail">
      <div className="video-detail__header">
        {isEditing ? (
          <input
            className="chat-list__rename video-detail__rename"
            value={draft}
            maxLength={120}
            autoFocus
            aria-label="Video title"
            onFocus={(event) => event.target.select()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => finishEditing(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') finishEditing(true);
              else if (event.key === 'Escape') finishEditing(false);
            }}
          />
        ) : (
          <>
            <h3 className="video-detail__title">{video.title}</h3>
            <button
              type="button"
              className="chat-list__rename-button video-detail__edit"
              aria-label="Rename video"
              title="Rename video"
              onClick={startEditing}
            >
              ✎
            </button>
          </>
        )}
      </div>

      <ChatLink
        label="Script"
        linkedId={video.scriptConversationId}
        state={chatStates.script}
        conversations={conversations}
        onChange={(id) => onLink(video.id, 'scriptConversationId', id)}
        onOpen={onOpenChat}
        onStart={() => onStartPrompt(video.id, 'script')}
        openLabel="Open script chat"
        startLabel="Send Prompt 1"
      />
      <ChatLink
        label="Illustrator"
        linkedId={video.illustratorConversationId}
        state={chatStates.illustrator}
        conversations={conversations}
        onChange={(id) => onLink(video.id, 'illustratorConversationId', id)}
        onOpen={onOpenChat}
        onStart={() => onStartPrompt(video.id, 'illustrator')}
        openLabel="Open illustrator chat"
        startLabel="Send Prompt 2"
      />

      <VoicePanel video={video} scriptMessages={scriptMessages} voice={voice} onSaveNarration={onSaveNarration} />

      <CharactersPanel
        video={video}
        characters={characters}
        onSetProject={onSetFlowProject}
        onOpenProject={onOpenFlowProject}
      />

      <div>
        <p className="settings__card-text">
          Click a stage to cycle: automatic, forced done, forced not done, back to automatic.
        </p>
        <StageTrack stages={stages} onToggle={(stage) => onToggleStage(video, stage)} />
      </div>

      <div className="saved-idea__actions">
        {isConfirming ? (
          <>
            <button type="button" className="settings__button settings__button--danger" onClick={() => onDelete(video.id)}>
              Confirm delete
            </button>
            <button type="button" className="settings__button settings__button--ghost" onClick={() => setIsConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" className="settings__button settings__button--danger" onClick={() => setIsConfirming(true)}>
            Delete video
          </button>
        )}
      </div>
    </div>
  );
}
