import Markdown from '../chat/Markdown.jsx';
import CopyScriptButton from '../chat/CopyScriptButton.jsx';

export default function ScriptStagePanel({ scriptText, hasChosenIdea }) {
  if (scriptText) {
    return (
      <div className="video-detail__script-panel">
        <div className="video-detail__script-actions">
          <CopyScriptButton text={scriptText} />
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
