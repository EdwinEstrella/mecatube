import { useCallback, useEffect, useMemo, useState } from 'react';
import VideoRow from './timeline/VideoRow.jsx';
import { countDone, deriveStages, isPublished } from './timeline/stages.js';
import { charactersDone } from './flow/characterStatus.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'progress', label: 'In progress' },
  { id: 'published', label: 'Published' },
];

function cleanError(error) {
  return error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

// 'ok' | 'deleted' | 'none' for a linked conversation id
function chatState(linkedId, chats) {
  if (!linkedId) return 'none';
  return chats[linkedId] ? 'ok' : 'deleted';
}

// Container: loads videos plus the messages of their linked chats and derives the stages
export default function TimelineView({ onOpenChat, onChatAction, initialVideoId = null, onInitialConsumed }) {
  const [videos, setVideos] = useState([]);
  const [conversations, setConversations] = useState([]);
  // Messages of every linked chat by conversation id; null when the chat no longer exists
  const [chats, setChats] = useState({});
  // Voice-over meta by video id; null when the video has no narration track yet
  const [voices, setVoices] = useState({});
  // Stored Flow character records by video id
  const [characters, setCharacters] = useState({});
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(initialVideoId);
  const [error, setError] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    const [videoList, conversationList] = await Promise.all([api.listVideos(), api.listConversations()]);
    const ids = new Set(
      videoList.flatMap((video) => [video.scriptConversationId, video.illustratorConversationId]).filter(Boolean),
    );
    const loaded = await Promise.all([...ids].map(async (id) => [id, (await api.getConversation(id))?.messages ?? null]));
    const voiceMetas = await Promise.all(videoList.map(async (video) => [video.id, (await api.getVoice(video.id)) ?? null]));
    const characterLists = await Promise.all(videoList.map(async (video) => [video.id, (await api.getCharacters(video.id)) ?? []]));
    setVideos(videoList);
    setVoices(Object.fromEntries(voiceMetas));
    setCharacters(Object.fromEntries(characterLists));
    setConversations(conversationList ?? []);
    setChats(Object.fromEntries(loaded));
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    refresh().catch((refreshError) => setError(cleanError(refreshError)));
    const api = window.electronAPI;
    if (!api) return undefined;
    const offChat = api.onChatDone(() => refresh().catch(() => {}));
    const offVoice = api.onVoiceFinished(() => refresh().catch(() => {}));
    const offFlow = api.onFlowResult(() => refresh().catch(() => {}));
    return () => {
      offChat();
      offVoice();
      offFlow();
    };
  }, [refresh]);

  // Expands the video another view asked for (e.g. "Ver en Timeline" in the chat)
  useEffect(() => {
    if (!initialVideoId) return;
    setOpenId(initialVideoId);
    onInitialConsumed?.();
  }, [initialVideoId, onInitialConsumed]);

  const rows = useMemo(
    () =>
      videos.map((video) => {
        const stages = deriveStages(video, chats[video.scriptConversationId], chats[video.illustratorConversationId], {
          hasVoice: Boolean(voices[video.id]),
          charactersApproved: charactersDone(characters[video.id]),
        });
        return { video, stages, doneCount: countDone(stages), published: isPublished(stages) };
      }),
    [videos, chats, voices, characters],
  );

  const visible = rows.filter((row) => {
    if (filter === 'published') return row.published;
    if (filter === 'progress') return !row.published;
    return true;
  });

  const run = async (action) => {
    setError('');
    try {
      await action();
    } catch (actionError) {
      setError(cleanError(actionError));
    }
    await refresh().catch(() => {});
  };

  // Creates the video, then hands the Prompt 1 send to the chat; it links the new conversation afterwards
  const handleNew = async () => {
    setError('');
    try {
      const video = await window.electronAPI.createVideo({});
      onChatAction({ type: 'send-preset', presetId: 'prompt-1', videoId: video.id, role: 'script' });
    } catch (createError) {
      setError(cleanError(createError));
    }
  };

  const handleStartPrompt = (videoId, role) =>
    onChatAction({
      type: 'send-preset',
      presetId: role === 'illustrator' ? 'prompt-2' : 'prompt-1',
      videoId,
      role,
    });

  // Cycle: automatic -> forced done -> forced not done -> automatic
  const handleToggleStage = (video, stage) => {
    const current = video.overrides?.[stage.key];
    const next = current === undefined ? true : current === true ? false : null;
    return run(() => window.electronAPI.setVideoStage(video.id, stage.key, next));
  };

  const detail = {
    conversations,
    // Saved quietly (no error banner reset); the refresh keeps the stored text in sync for later opens
    onSaveNarration: (id, narrationText) =>
      window.electronAPI
        .updateVideo(id, { narrationText })
        .then(() => refresh())
        .catch((saveError) => setError(cleanError(saveError))),
    onRename: (id, title) => run(() => window.electronAPI.updateVideo(id, { title })),
    onLink: (id, field, conversationId) => run(() => window.electronAPI.updateVideo(id, { [field]: conversationId })),
    onSetFlowProject: (id, url) => run(() => window.electronAPI.setFlowProject(id, url)),
    onOpenFlowProject: (id) => run(() => window.electronAPI.openFlowProject(id)),
    onOpenChat,
    onStartPrompt: handleStartPrompt,
    onToggleStage: handleToggleStage,
    onDelete: (id) => {
      setOpenId(null);
      return run(() => window.electronAPI.deleteVideo(id));
    },
  };

  return (
    <div className="settings timeline">
      <div className="timeline__header">
        <h1 className="settings__title timeline__title">Timeline</h1>
        <button type="button" className="settings__button settings__button--primary" onClick={handleNew}>
          Send Prompt 1
        </button>
      </div>

      <div className="timeline__filters" role="group" aria-label="Filter videos">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`timeline__chip${filter === item.id ? ' timeline__chip--active' : ''}`}
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <p className="chat-messages__error">{error}</p>}

      {isLoaded && videos.length === 0 && (
        <div className="timeline__empty">
          <p className="settings__empty">No videos yet. Start one and track it from idea to published.</p>
          <button type="button" className="settings__button settings__button--primary" onClick={handleNew}>
            Send Prompt 1
          </button>
        </div>
      )}
      {isLoaded && videos.length > 0 && visible.length === 0 && <p className="settings__empty">No videos match this filter.</p>}

      <ul className="video-list">
        {visible.map(({ video, stages, doneCount }) => (
          <VideoRow
            key={video.id}
            video={video}
            stages={stages}
            doneCount={doneCount}
            isOpen={openId === video.id}
            onToggleOpen={() => setOpenId((current) => (current === video.id ? null : video.id))}
            detail={{
              ...detail,
              scriptMessages: chats[video.scriptConversationId],
              voice: voices[video.id],
              characters: characters[video.id] ?? [],
              chatStates: {
                script: chatState(video.scriptConversationId, chats),
                illustrator: chatState(video.illustratorConversationId, chats),
              },
            }}
          />
        ))}
      </ul>
    </div>
  );
}
