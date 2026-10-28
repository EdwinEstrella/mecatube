import { useCallback, useEffect, useMemo, useState } from 'react';
import VideoDetail from './timeline/VideoDetail.jsx';
import BranchTree from './timeline/BranchTree.jsx';
import NewBranchWizard from './workspace/NewBranchWizard.jsx';
import DeleteBranchModal from './timeline/DeleteBranchModal.jsx';
import { countDone, deriveStages } from './timeline/stages.js';
import { charactersDone } from './flow/characterStatus.js';

function cleanError(error) {
  return error.message ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : '';
}

// 'ok' | 'deleted' | 'none' for a linked conversation id
function chatState(linkedId, chats) {
  if (!linkedId) return 'none';
  return chats[linkedId] ? 'ok' : 'deleted';
}

// Container: workspace tree + active video timeline detail
export default function TimelineView({
  onOpenChat,
  onChatAction,
  initialVideoId = null,
  onInitialConsumed,
}) {
  const [branches, setBranches] = useState([]);
  const [videos, setVideos] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [chats, setChats] = useState({});
  const [voices, setVoices] = useState({});
  const [characters, setCharacters] = useState({});
  const [expandedBranchIds, setExpandedBranchIds] = useState(() => new Set());
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(false);
  const [wizardBranch, setWizardBranch] = useState(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [deletingBranch, setDeletingBranch] = useState(null);
  const [error, setError] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    const [active, branchList, videoList, conversationList] = await Promise.all([
      api.getActiveVideo(),
      api.listBranches(),
      api.listVideos(),
      api.listConversations(),
    ]);

    const ids = new Set(
      videoList.flatMap((video) => [video.scriptConversationId, video.illustratorConversationId]).filter(Boolean),
    );
    const loaded = await Promise.all([...ids].map(async (id) => [id, (await api.getConversation(id))?.messages ?? null]));
    const voiceMetas = await Promise.all(videoList.map(async (video) => [video.id, (await api.getVoice(video.id)) ?? null]));
    const characterLists = await Promise.all(videoList.map(async (video) => [video.id, (await api.getCharacters(video.id)) ?? []]));

    setBranches(branchList ?? []);
    setActiveVideo(active ?? null);
    setVideos(videoList ?? []);
    setVoices(Object.fromEntries(voiceMetas));
    setCharacters(Object.fromEntries(characterLists));
    setConversations(conversationList ?? []);
    setChats(Object.fromEntries(loaded));
    setIsLoaded(true);

    if (active?.branchId) {
      setExpandedBranchIds((prev) => {
        if (prev.has(active.branchId)) return prev;
        const next = new Set(prev);
        next.add(active.branchId);
        return next;
      });
    }
  }, []);

  // Dead handoff fix: consume initialVideoId
  useEffect(() => {
    if (initialVideoId && window.electronAPI) {
      window.electronAPI
        .setActiveVideo(initialVideoId)
        .then(() => {
          window.dispatchEvent(new CustomEvent('mecatube:active-video-changed', { detail: { videoId: initialVideoId } }));
          return refresh();
        })
        .then(() => onInitialConsumed?.())
        .catch((initialError) => setError(cleanError(initialError)));
    }
  }, [initialVideoId, onInitialConsumed, refresh]);

  // Listen to active video changes
  useEffect(() => {
    const handleActiveChanged = () => {
      refresh().catch(() => {});
    };
    window.addEventListener('mecatube:active-video-changed', handleActiveChanged);
    return () => window.removeEventListener('mecatube:active-video-changed', handleActiveChanged);
  }, [refresh]);

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

  const video = activeVideo ?? null;

  const stages = useMemo(() => {
    if (!video) return [];
    const currentBranch = branches.find((b) => b.id === video.branchId);
    return deriveStages(video, chats[video.scriptConversationId], chats[video.illustratorConversationId], {
      hasVoice: Boolean(voices[video.id]),
      charactersApproved: charactersDone(characters[video.id]),
      videoType: currentBranch?.videoType,
      branch: currentBranch,
    });
  }, [video, branches, chats, voices, characters]);

  const doneCount = countDone(stages);

  const videoStagesMap = useMemo(() => {
    const map = {};
    for (const vid of videos) {
      const vidBranch = branches.find((b) => b.id === vid.branchId);
      const vidStages = deriveStages(vid, chats[vid.scriptConversationId], chats[vid.illustratorConversationId], {
        hasVoice: Boolean(voices[vid.id]),
        charactersApproved: charactersDone(characters[vid.id]),
        videoType: vidBranch?.videoType,
        branch: vidBranch,
      });
      map[vid.id] = {
        doneCount: countDone(vidStages),
        total: vidStages.length,
      };
    }
    return map;
  }, [videos, branches, chats, voices, characters]);

  const run = async (action) => {
    setError('');
    try {
      await action();
    } catch (actionError) {
      setError(cleanError(actionError));
    }
    await refresh().catch(() => {});
  };

  const handleSelectVideo = async (videoId) => {
    setError('');
    try {
      await window.electronAPI.setActiveVideo(videoId);
      window.dispatchEvent(new CustomEvent('mecatube:active-video-changed', { detail: { videoId } }));
      await refresh();
    } catch (selectError) {
      setError(cleanError(selectError));
    }
  };

  const handleCreateVideoInBranch = async (branchId) => {
    setError('');
    try {
      const created = await window.electronAPI.createVideo({ newVideo: true, branchId });
      window.dispatchEvent(new CustomEvent('mecatube:active-video-changed', { detail: { videoId: created.id } }));
      await refresh();
    } catch (createError) {
      setError(cleanError(createError));
    }
  };

  const handleToggleBranch = (branchId) => {
    setExpandedBranchIds((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
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
    onEdited: () => refresh().catch((refreshError) => setError(cleanError(refreshError))),
  };

  return (
    <div className="settings timeline timeline--split">
      {error && <p className="chat-messages__error">{error}</p>}

      <div className="timeline__container">
        <BranchTree
          branches={branches}
          videos={videos}
          activeVideoId={video?.id}
          expandedBranchIds={expandedBranchIds}
          onToggleBranch={handleToggleBranch}
          onSelectVideo={handleSelectVideo}
          onCreateVideo={handleCreateVideoInBranch}
          onNewBranch={() => {
            setWizardBranch(null);
            setIsWizardOpen(true);
          }}
          onEditBranch={(branchToEdit) => {
            setWizardBranch(branchToEdit);
            setIsWizardOpen(true);
          }}
          onDeleteBranch={(branchToDelete) => {
            setDeletingBranch(branchToDelete);
          }}
          isCollapsed={isTreeCollapsed}
          onToggleCollapse={() => setIsTreeCollapsed((prev) => !prev)}
          videoStagesMap={videoStagesMap}
        />

        <div className="timeline__detail-pane">
          {isLoaded && video ? (
            <VideoDetail
              video={video}
              branch={branches.find((b) => b.id === video.branchId)}
              stages={stages}
              doneCount={doneCount}
              onSendPrompt1={handleSendPrompt1}
              onEditBranch={(branchToEdit) => {
                setWizardBranch(branchToEdit);
                setIsWizardOpen(true);
              }}
              onBranchUpdated={refresh}
              {...detail}
              scriptMessages={chats[video.scriptConversationId]}
              voice={voices[video.id]}
              characters={characters[video.id] ?? []}
              chatStates={{
                script: chatState(video.scriptConversationId, chats),
                illustrator: chatState(video.illustratorConversationId, chats),
              }}
            />
          ) : isLoaded ? (
            <div className="timeline__empty">
              <p className="timeline__empty-text">Selecciona o crea un video para ver su línea de tiempo.</p>
            </div>
          ) : null}
        </div>
      </div>

      <NewBranchWizard
        isOpen={isWizardOpen}
        branch={wizardBranch}
        onClose={() => {
          setIsWizardOpen(false);
          setWizardBranch(null);
        }}
        onSaved={() => refresh()}
      />

      <DeleteBranchModal
        isOpen={Boolean(deletingBranch)}
        branch={deletingBranch}
        onClose={() => setDeletingBranch(null)}
        onDeleted={() => refresh()}
      />
    </div>
  );
}
