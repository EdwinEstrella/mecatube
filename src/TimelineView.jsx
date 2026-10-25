import { useCallback, useEffect, useMemo, useState } from 'react';
import VideoDetail from './timeline/VideoDetail.jsx';
import { countDone, deriveStages } from './timeline/stages.js';
import { charactersDone } from './flow/characterStatus.js';

function cleanError(error) {
  return error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

// 'ok' | 'deleted' | 'none' for a linked conversation id
function chatState(linkedId, chats) {
  if (!linkedId) return 'none';
  return chats[linkedId] ? 'ok' : 'deleted';
}

// Container: 1 workspace = 1 video timeline project
export default function TimelineView({ onOpenChat, onChatAction }) {
  const [videos, setVideos] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [chats, setChats] = useState({});
  const [voices, setVoices] = useState({});
  const [characters, setCharacters] = useState({});
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

  const video = videos[0] ?? null;

  const stages = useMemo(() => {
    if (!video) return [];
    return deriveStages(video, chats[video.scriptConversationId], chats[video.illustratorConversationId], {
      hasVoice: Boolean(voices[video.id]),
      charactersApproved: charactersDone(characters[video.id]),
    });
  }, [video, chats, voices, characters]);

  const doneCount = countDone(stages);

  const run = async (action) => {
    setError('');
    try {
      await action();
    } catch (actionError) {
      setError(cleanError(actionError));
    }
    await refresh().catch(() => {});
  };

  const handleSendPrompt1 = async () => {
    setError('');
    try {
      const v = video ?? (await window.electronAPI.createVideo({}));
      onChatAction({ type: 'send-preset', presetId: 'prompt-1', videoId: v.id, role: 'script' });
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

  const handleToggleStage = (targetVideo, stage) => {
    const current = targetVideo.overrides?.[stage.key];
    const next = current === undefined ? true : current === true ? false : null;
    return run(() => window.electronAPI.setVideoStage(targetVideo.id, stage.key, next));
  };

  const detail = {
    conversations,
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
    onDelete: (id) => run(() => window.electronAPI.deleteVideo(id)),
  };

  return (
    <div className="settings timeline">
      {error && <p className="chat-messages__error">{error}</p>}

      {isLoaded && video && (
        <VideoDetail
          video={video}
          stages={stages}
          doneCount={doneCount}
          onSendPrompt1={handleSendPrompt1}
          {...detail}
          scriptMessages={chats[video.scriptConversationId]}
          voice={voices[video.id]}
          characters={characters[video.id] ?? []}
          chatStates={{
            script: chatState(video.scriptConversationId, chats),
            illustrator: chatState(video.illustratorConversationId, chats),
          }}
        />
      )}
    </div>
  );
}
