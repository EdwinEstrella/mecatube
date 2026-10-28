import { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from './Markdown.jsx';
import IdeaCards from './IdeaCards.jsx';
import { parseIdeas } from './parseIdeas.js';
import CharacterCards from '../flow/CharacterCards.jsx';
import { parseCharacterSheets } from '../flow/parseCharacterSheets.js';
import SceneCards, { ThumbnailCard } from '../flow/SceneCards.jsx';
import AnimationCards from '../flow/AnimationCards.jsx';
import { nextStepPrompt } from './nextStep.js';
import { collectImageScenes, parseImageScenes } from '../flow/parseImageScenes.js';
import { animationSeconds } from '../flow/animationSeconds.js';
import { parseThumbnail } from '../flow/parseThumbnail.js';
import { chosenIdeaNumber, hasUserMessageAfter } from './chosenIdea.js';
import { isScriptMessage } from '../timeline/stages.js';
import { extractNarration } from '../voice/narration.js';
import ScriptVoiceControl from '../voice/ScriptVoiceControl.jsx';
import CopyScriptButton from './CopyScriptButton.jsx';

// The illustrator's closing question ("¿Paso al siguiente bloque?") as one button per option
function NextStepButtons({ step, canSend, onSend }) {
  if (!step) return null;
  return (
    <div className="next-step">
      <p className="next-step__question">{step.question}</p>
      <div className="next-step__options">
        {step.options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            className={`settings__button ${index === 0 ? 'settings__button--primary' : 'settings__button--ghost'}`}
            disabled={!canSend}
            onClick={() => onSend(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
          {expanded ? 'Ver menos' : 'Ver más'}
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
  scenes,
  animations,
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
        flow?.available && !flow?.branchHasCharacters && message.role === 'assistant' && !parsed[index]
          ? parseCharacterSheets(message.content)
          : null,
      ),
    [messages, parsed, flow?.available, flow?.branchHasCharacters],
  );
  // Image-block deliveries (ETAPA 3) and animation-block deliveries (ETAPA 4)
  const imageBlocks = useMemo(() => {
    const rawBlocks = messages.map((message, index) =>
      flow?.available && scenes?.available && message.role === 'assistant' && !parsed[index] && !sheets[index]
        ? parseImageScenes(message.content)
        : null,
    );
    const imageScenes = collectImageScenes(messages);
    const anchorByNumber = new Map(imageScenes.map((scene) => [scene.number, scene.scriptAnchor]));
    return rawBlocks.map((block) => {
      if (!block || block.kind !== 'animations') return block;
      return {
        ...block,
        scenes: block.scenes.map((scene) => {
          const scriptAnchor = scene.scriptAnchor || anchorByNumber.get(scene.number) || '';
          return {
            ...scene,
            scriptAnchor,
            seconds: animationSeconds(scriptAnchor),
          };
        }),
      };
    });
  }, [messages, parsed, sheets, flow?.available, scenes?.available]);
  // Thumbnail delivery (ETAPA 5): one card with a "Generar miniatura en Flow" button
  const thumbnails = useMemo(
    () =>
      messages.map((message, index) =>
        flow?.available && scenes?.available && message.role === 'assistant' && !parsed[index] && !sheets[index] && !imageBlocks[index]
          ? parseThumbnail(message.content)
          : null,
      ),
    [messages, parsed, sheets, imageBlocks, flow?.available, scenes?.available],
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
        <p className="chat-messages__empty">Envía un mensaje para iniciar una conversación con DeepSeek.</p>
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
        const blockResult = imageBlocks[index];
        if (blockResult) {
          return (
            <div key={message.id} className="chat-message chat-message--assistant chat-message--ideas">
              {blockResult.intro && <Markdown>{blockResult.intro}</Markdown>}
              {blockResult.kind === 'animations' ? (
                <AnimationCards
                  block={blockResult.block}
                  animations={blockResult.scenes}
                  flow={animations}
                  sceneRecords={scenes.records}
                  characterBusy={flow.job !== null}
                />
              ) : (
                <SceneCards block={blockResult.block} scenes={blockResult.scenes} flow={scenes} characterBusy={flow.job !== null} />
              )}
              {blockResult.outro && <Markdown>{blockResult.outro}</Markdown>}
              {!hasUserMessageAfter(messages, index) && (
                <NextStepButtons step={nextStepPrompt(message.content)} canSend={canSend} onSend={onSend} />
              )}
              <details className="char-original">
                <summary>Mensaje original</summary>
                <Markdown>{message.content}</Markdown>
              </details>
            </div>
          );
        }
        const thumbnail = thumbnails[index];
        if (thumbnail) {
          return (
            <div key={message.id} className="chat-message chat-message--assistant chat-message--ideas">
              {thumbnail.intro && <Markdown>{thumbnail.intro}</Markdown>}
              <ThumbnailCard thumbnail={thumbnail} flow={scenes} characterBusy={flow.job !== null} />
              {thumbnail.outro && <Markdown>{thumbnail.outro}</Markdown>}
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
                  voiceId={scriptVoice.voiceId}
                  voiceName={scriptVoice.voiceName}
                  onVoiceChange={scriptVoice.chooseVoice}
                  videoId={scriptVoice.videoId}
                  track={scriptVoice.track}
                  configured={scriptVoice.configured}
                  busyElsewhere={scriptVoice.busy && scriptVoice.phase?.messageId !== message.id}
                  phase={scriptVoice.phase?.messageId === message.id ? scriptVoice.phase.kind : 'idle'}
                  seconds={scriptVoice.seconds}
                  error={scriptVoice.error?.messageId === message.id ? scriptVoice.error.text : ''}
                  expandPlayer={scriptVoice.doneId === message.id}
                  usesCartesia={scriptVoice.usesCartesia}
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
                Más ideas
              </button>
            )}
          </div>
        );
      })}

      {isWaiting && (
        <div className="chat-message chat-message--assistant chat-message--streaming">
          {streamingText ? <Markdown>{streamingText}</Markdown> : 'Esperando a DeepSeek…'}
        </div>
      )}

      {error && <div className="chat-messages__error">{error}</div>}
      <div ref={endRef} />
    </div>
  );
}
