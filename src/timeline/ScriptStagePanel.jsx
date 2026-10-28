import Markdown from '../chat/Markdown.jsx';
import CopyScriptButton from '../chat/CopyScriptButton.jsx';

export default function ScriptStagePanel({
  scriptText,
  hasChosenIdea,
  illustratorActionLabel = 'Enviar Prompt 2',
  onIllustratorAction,
  showVoiceAction = false,
  voiceActionLabel = 'Generar voz en off',
  onVoiceAction,
}) {

  if (scriptText) {
    return (
      <div className="video-detail__script-panel">
        <div className="video-detail__script-actions">
          <CopyScriptButton text={scriptText} />
          {onIllustratorAction && (
            <button
              type="button"
              className="settings__button settings__button--primary"
              onClick={onIllustratorAction}
            >
              {illustratorActionLabel}
            </button>
          )}
          {showVoiceAction && onVoiceAction && (
            <button
              type="button"
              className="settings__button settings__button--ghost"
              onClick={onVoiceAction}
            >
              {voiceActionLabel}
            </button>
          )}
        </div>
        <div className="video-detail__script-scroll">
          <Markdown>{scriptText}</Markdown>
        </div>
      </div>
    );
  }

  if (hasChosenIdea) {
    return <p className="video-detail__stage-hint">DeepSeek está escribiendo el guion…</p>;
  }

  return <p className="video-detail__stage-hint">Elige una idea en la etapa Idea para generar el guion.</p>;
}
