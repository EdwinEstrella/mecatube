import { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from './Markdown.jsx';
import IdeaCards from './IdeaCards.jsx';
import { parseIdeas } from './parseIdeas.js';
import CharacterCards from '../flow/CharacterCards.jsx';
import { parseCharacterSheets } from '../flow/parseCharacterSheets.js';
import { chosenIdeaNumber, hasUserMessageAfter } from './chosenIdea.js';
import { isScriptMessage } from '../timeline/stages.js';
import { extractNarration } from '../voice/narration.js';
import ScriptVoiceControl from '../voice/ScriptVoiceControl.jsx';
import CopyScriptButton from './CopyScriptButton.jsx';

const COLLAPSE_CHARS = 600;
const COLLAPSE_LINES = 12;
// The literal option Prompt 1 offers for getting 10 new ideas
const MORE_IDEAS_TEXT = 'más ideas';

// User messages stay plain text; long ones are shown as a preview with a toggle
function UserMessage({ content }) {
  const [expanded, setExpanded] = useState(false);
  const lines = content.split('\n');
  const isLong = content.length > COLLAPSE_CHARS || lines.length > COLLAPSE_LINES;
  const preview = `${lines.slice(0, COLLAPSE_LINES).join('\n').slice(0, COLLAPSE_CHARS).trimEnd()}…`;

  return (
    <div className="chat-message chat-message--user">
      {isLong && !expanded ? preview : content}
      {isLong && (
        <button type="button" className="chat-message__toggle" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

// savedKeys: Set of `${messageId}:${number}` for the open conversation
export default function MessageList({
  messages,
  streamingText,
  isWaiting,
  error,
  savedKeys,
  canSend,
  onSend,
  onToggleIdea,
  onChooseIdea,
  scriptVoice,
  flow,
  onOpenTimeline,
  onOpenSettings,
}) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, streamingText, isWaiting, error]);

  // Only finished assistant messages are parsed; the streaming reply never is
  const parsed = useMemo(
    () => messages.map((message) => (message.role === 'assistant' ? parseIdeas(message.content) : null)),
    [messages],
  );
  const latestIdeasIndex = parsed.reduce((latest, result, index) => (result ? index : latest), -1);
  // Character-sheet deliveries (illustrator chat); only meaningful when the Flow bridge is available
  const sheets = useMemo(
    () =>
      messages.map((message, index) =>
        flow?.available && message.role === 'assistant' && !parsed[index] ? parseCharacterSheets(message.content) : null,
      ),
    [messages, parsed, flow?.available],
  );
  const latestSheetsIndex = sheets.reduce((latest, result, index) => (result ? index : latest), -1);
  // Narration length per finished script message; null for every other message
  const narrationLengths = useMemo(
    () =>
      messages.map((message) =>
        message.role === 'assistant' && isScriptMessage(message.content) ? extractNarration(message.content).length : null,
      ),
    [messages],
  );

  return (
    <div className="chat-messages">
      {messages.length === 0 && !isWaiting && (
        <p className="chat-messages__empty">Send a message to start a conversation with DeepSeek.</p>
      )}

      {messages.map((message, index) => {
        if (message.role === 'user') return <UserMessage key={message.id} content={message.content} />;

        const result = parsed[index];
        const sheetResult = sheets[index];
        if (sheetResult) {
          const isOpen = index === latestSheetsIndex && !hasUserMessageAfter(messages, index);
          return (
            <div key={message.id} className="chat-message chat-message--assistant chat-message--ideas">
              <CharacterCards
                characters={sheetResult.characters}
                flow={flow}
                isOpen={isOpen}
                canSend={canSend}
                onApprove={async (keys) => {
                  if (await flow.approve(keys)) onSend('1');
                }}
                onRequestChanges={async (keys) => {
                  await flow.unapprove(keys);
                  onSend('2');
                }}
              />
              <details className="char-original">
                <summary>Mensaje original</summary>
                <Markdown>{message.content}</Markdown>
              </details>
            </div>
          );
        }
        if (!result) {
          return (
            <div key={message.id} className="chat-message chat-message--assistant">
              <Markdown>{message.content}</Markdown>
              {narrationLengths[index] !== null && <CopyScriptButton text={message.content} />}
              {scriptVoice && narrationLengths[index] !== null && (
                <ScriptVoiceControl
                  chars={narrationLengths[index]}
                  voiceName={scriptVoice.voiceName}
                  videoId={scriptVoice.videoId}
                  track={scriptVoice.track}
                  configured={scriptVoice.configured}
                  busyElsewhere={scriptVoice.busy && scriptVoice.phase?.messageId !== message.id}
                  phase={scriptVoice.phase?.messageId === message.id ? scriptVoice.phase.kind : 'idle'}
                  seconds={scriptVoice.seconds}
                  error={scriptVoice.error?.messageId === message.id ? scriptVoice.error.text : ''}
                  expandPlayer={scriptVoice.doneId === message.id}
                  onRequest={() => scriptVoice.request(message.id)}
                  onConfirm={() => scriptVoice.confirm(message)}
                  onCancelConfirm={scriptVoice.cancelConfirm}
                  onCancelGeneration={scriptVoice.cancelGeneration}
                  onOpenFolder={scriptVoice.openFolder}
                  onOpenTimeline={() => onOpenTimeline?.(scriptVoice.videoId)}
                  onOpenSettings={onOpenSettings}
                />
              )}
            </div>
          );
        }

        // Choosing is only possible on the latest ideas message while no user message follows it
        const isOpen = index === latestIdeasIndex && !hasUserMessageAfter(messages, index);
        const savedNumbers = new Set(
          result.ideas.filter((idea) => savedKeys.has(`${message.id}:${idea.number}`)).map((idea) => idea.number),
        );
        return (
          <div key={message.id} className="chat-message chat-message--assistant chat-message--ideas">
            {result.intro && <Markdown>{result.intro}</Markdown>}
            <IdeaCards
              ideas={result.ideas}
              savedNumbers={savedNumbers}
              chosenNumber={chosenIdeaNumber(messages, index)}
              canChoose={isOpen && canSend}
              onChoose={(number) => {
                const idea = result.ideas.find((item) => item.number === number);
                if (onChooseIdea && idea) onChooseIdea(idea);
                else onSend(String(number));
              }}
              onToggleSave={(idea) => onToggleIdea(message, idea)}
            />
            {result.outro && <Markdown>{result.outro}</Markdown>}
            {isOpen && (
              <button type="button" className="idea-more" disabled={!canSend} onClick={() => onSend(MORE_IDEAS_TEXT)}>
                More ideas
              </button>
            )}
          </div>
        );
      })}

      {isWaiting && (
        <div className="chat-message chat-message--assistant chat-message--streaming">
          {streamingText ? <Markdown>{streamingText}</Markdown> : 'Waiting for DeepSeek…'}
        </div>
      )}

      {error && <div className="chat-messages__error">{error}</div>}
      <div ref={endRef} />
    </div>
  );
}
