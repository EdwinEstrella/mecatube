import { useCallback, useEffect, useState } from 'react';
import IdeaList from './ideas/IdeaList.jsx';

function ideaAsText(idea) {
  return [
    `${idea.number}. ${idea.title}`,
    idea.format && `Formato: ${idea.format}`,
    idea.question && `Pregunta central: ${idea.question}`,
    idea.thumbnailText && `Texto de miniatura: "${idea.thumbnailText}"`,
    idea.trigger && `Gatillo principal: ${idea.trigger}`,
  ]
    .filter(Boolean)
    .join('\n');
}

// Container: loads the favorite ideas and handles remove / open chat / copy
export default function IdeasView({ onOpenChat }) {
  const [ideas, setIdeas] = useState([]);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setIdeas((await window.electronAPI?.listIdeas()) ?? []);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRemove = async (id) => {
    setError('');
    try {
      await window.electronAPI.deleteIdea(id);
    } catch (removeError) {
      setError(removeError.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    }
    refresh();
  };

  const handleCopy = async (idea) => {
    try {
      await navigator.clipboard.writeText(ideaAsText(idea));
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="settings">
      <h1 className="settings__title">Ideas</h1>
      {error && <p className="chat-messages__error">{error}</p>}
      <IdeaList ideas={ideas} onOpenChat={onOpenChat} onRemove={handleRemove} onCopy={handleCopy} />
    </div>
  );
}
