import { useState } from 'react';
import IdeaCards from '../chat/IdeaCards.jsx';
import { cleanIpcError } from '../voice/constants.js';

export default function IdeaStagePanel({ hasLinkedChat, ideasData, onSendIdea }) {
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  if (!hasLinkedChat) return null;

  if (!ideasData) {
    return <p className="video-detail__stage-hint">Esperando las ideas de DeepSeek…</p>;
  }

  const { parsed, chosenNumber: alreadyChosen } = ideasData;
  const isAlreadyChosen = alreadyChosen !== null && alreadyChosen !== undefined;

  const handleSend = async () => {
    if (selectedNumber === null || isSending) return;
    const idea = parsed?.ideas?.find((item) => item.number === selectedNumber);
    if (!idea) return;
    setError(null);
    setIsSending(true);
    try {
      await onSendIdea(idea);
    } catch (sendError) {
      setError(cleanIpcError(sendError));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="video-detail__idea-panel">
      {isAlreadyChosen && (
        <p className="video-detail__stage-hint">Idea elegida: {alreadyChosen}</p>
      )}

      <div className="video-detail__ideas-container">
        <IdeaCards
          ideas={parsed?.ideas ?? []}
          savedNumbers={new Set()}
          chosenNumber={isAlreadyChosen ? alreadyChosen : selectedNumber}
          canChoose={!isAlreadyChosen && !isSending}
          onChoose={(num) => {
            if (!isAlreadyChosen && !isSending) {
              setSelectedNumber(num);
            }
          }}
          onToggleSave={() => {}}
        />
      </div>

      {!isAlreadyChosen && (
        <div className="video-detail__idea-actions">
          <button
            type="button"
            className="settings__button settings__button--primary"
            disabled={selectedNumber === null || isSending}
            onClick={handleSend}
          >
            {isSending ? 'Enviando…' : 'Enviar idea'}
          </button>
          {error && (
            <p className="video-detail__error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
