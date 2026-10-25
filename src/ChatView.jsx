import { useCallback, useEffect, useRef, useState } from 'react';
import ConversationList from './chat/ConversationList.jsx';
import MessageList from './chat/MessageList.jsx';
import Composer from './chat/Composer.jsx';
import PromptPresets from './chat/PromptPresets.jsx';
import { PRESETS, effectiveText, loadOverrides } from './prompts/presets.js';
import { syncChosenIdea } from './timeline/syncChosenIdea.js';
import { useScriptVoice } from './voice/useScriptVoice.js';
import { useFlowCharacters } from './flow/useFlowCharacters.js';

// Strips the "Error invoking remote method" prefix Electron adds to IPC rejections
function cleanError(error) {
  return error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

// Container: owns chat state and the IPC subscriptions
export default function ChatView({
  initialConversationId = null,
  onInitialConsumed,
  pendingAction = null,
  onActionConsumed,
  onOpenTimeline,
  onOpenSettings,
}) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  // The one reply in flight: { conversationId, text }; conversationId is null for a new chat
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  // True once the first bridge status reply arrived, so a queued action does not run on the initial "false"
  const [bridgeChecked, setBridgeChecked] = useState(false);
  const [savedIdeas, setSavedIdeas] = useState([]);
  // DeepSeek chat URL of the active conversation (needed to resync it) and the resync state
  const [activeUrl, setActiveUrl] = useState(null);
  const [resync, setResync] = useState({ busy: false, message: '' });

  const activeIdRef = useRef(null);
  const actionRunningRef = useRef(false);

  const refreshList = useCallback(async () => {
    setConversations((await window.electronAPI?.listConversations()) ?? []);
  }, []);

  const openConversation = useCallback(async (id) => {
    activeIdRef.current = id;
    setActiveId(id);
    setError('');
    setResync((current) => (current.busy ? current : { busy: false, message: '' }));
    if (!id) {
      setMessages([]);
      setActiveUrl(null);
      return;
    }
    const conversation = await window.electronAPI?.getConversation(id);
    if (activeIdRef.current !== id) return;
    setMessages(conversation?.messages ?? []);
    setActiveUrl(conversation?.deepseekUrl ?? null);
    if (!conversation) setError('That conversation no longer exists.');
  }, []);

  const refreshIdeas = useCallback(async () => {
    setSavedIdeas((await window.electronAPI?.listIdeas()) ?? []);
  }, []);

  // Opens the conversation requested by another view (e.g. "Open chat" on a saved idea)
  useEffect(() => {
    if (!initialConversationId) return;
    openConversation(initialConversationId);
    onInitialConsumed?.();
  }, [initialConversationId, onInitialConsumed, openConversation]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return undefined;

    refreshList();
    refreshIdeas();
    api.getBridgeStatus().then((connected) => {
      setIsConnected(connected);
      setBridgeChecked(true);
    });

    const unsubscribers = [
      api.onBridgeStatusChange(setIsConnected),
      api.onChatDelta(({ conversationId, text }) => {
        setPending((current) => (current ? { conversationId, text } : current));
      }),
      api.onChatDone(({ conversationId, message, source }) => {
        setPending(null);
        if (activeIdRef.current === conversationId) {
          setMessages((current) => [...current, message]);
          // The first reply of a new chat is what stores its DeepSeek URL
          api.getConversation(conversationId).then((conversation) => {
            if (activeIdRef.current === conversationId) setActiveUrl(conversation?.deepseekUrl ?? null);
          });
          if (source === 'dom') {
            setResync({
              busy: false,
              message: 'La respuesta se leyó de la página y puede estar incompleta. Usa «Resincronizar con DeepSeek» para repararla.',
            });
          }
        }
        refreshList();
      }),
      // A resync rewrote stored replies: reload the open conversation
      api.onChatRefresh(({ conversationId }) => {
        if (activeIdRef.current !== conversationId) return;
        api.getConversation(conversationId).then((conversation) => {
          if (activeIdRef.current === conversationId && conversation) setMessages(conversation.messages ?? []);
        });
      }),
      api.onChatError(({ conversationId, message }) => {
        setPending(null);
        if (activeIdRef.current === conversationId) setError(message);
        refreshList();
      }),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [refreshList, refreshIdeas]);

  const handleSend = async (text) => {
    setError('');
    const optimistic = { id: `local-${Date.now()}`, role: 'user', content: text, createdAt: Date.now() };
    setMessages((current) => [...current, optimistic]);
    setPending({ conversationId: activeIdRef.current, text: '' });

    try {
      const result = await window.electronAPI.sendChatMessage({
        conversationId: activeIdRef.current,
        text,
      });
      activeIdRef.current = result.conversationId;
      setActiveId(result.conversationId);
      setPending((current) => (current ? { ...current, conversationId: result.conversationId } : current));
      refreshList();
      return result.conversationId;
    } catch (sendError) {
      setPending(null);
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setError(cleanError(sendError));
      return null;
    }
  };

  // Each preset prompt starts its own conversation, i.e. a fresh DeepSeek chat
  const handlePreset = async (text) => {
    await openConversation(null);
    return handleSend(text);
  };

  // Runs a preset another view asked for (Timeline) and links the new chat to its video
  useEffect(() => {
    if (!pendingAction || actionRunningRef.current || !bridgeChecked || pending !== null) return;
    actionRunningRef.current = true;
    const action = pendingAction;
    onActionConsumed?.();

    (async () => {
      try {
        if (!isConnected) {
          await openConversation(null);
          setError('Connect the browser extension to start this prompt, then try again from the Timeline.');
          return;
        }
        const preset = PRESETS.find((item) => item.id === action.presetId);
        if (!preset) return;
        const conversationId = await handlePreset(effectiveText(preset, await loadOverrides()));
        if (!conversationId || !action.videoId) return;
        const field = action.role === 'illustrator' ? 'illustratorConversationId' : 'scriptConversationId';
        await window.electronAPI.updateVideo(action.videoId, { [field]: conversationId });
      } catch (actionError) {
        setError(cleanError(actionError));
      } finally {
        actionRunningRef.current = false;
      }
    })();
  });

  // Choosing sends the bare number, then mirrors the choice into the Timeline
  const handleChooseIdea = async (idea) => {
    const conversationId = await handleSend(String(idea.number));
    if (!conversationId) return;
    try {
      await syncChosenIdea(window.electronAPI, conversationId, idea);
    } catch (syncError) {
      setError(cleanError(syncError));
    }
  };

  // Hearts toggle by identity: conversation + message + idea number
  const handleToggleIdea = async (message, idea) => {
    const conversationId = activeIdRef.current;
    if (!conversationId) return;
    const saved = savedIdeas.find(
      (item) => item.conversationId === conversationId && item.messageId === message.id && item.number === idea.number,
    );
    try {
      if (saved) {
        await window.electronAPI.deleteIdea(saved.id);
      } else {
        await window.electronAPI.saveIdea({
          ...idea,
          conversationId,
          conversationTitle: conversations.find((item) => item.id === conversationId)?.title ?? '',
          messageId: message.id,
        });
      }
    } catch (ideaError) {
      setError(cleanError(ideaError));
    }
    refreshIdeas();
  };

  const handleDelete = async (id) => {
    try {
      await window.electronAPI.deleteConversation(id);
    } catch (deleteError) {
      setError(cleanError(deleteError));
      return;
    }
    if (activeIdRef.current === id) await openConversation(null);
    refreshList();
  };

  const handleRename = async (id, title) => {
    try {
      await window.electronAPI.renameConversation(id, title);
    } catch (renameError) {
      setError(cleanError(renameError));
      return;
    }
    refreshList();
  };

  const handleResync = async () => {
    const conversationId = activeIdRef.current;
    if (!conversationId) return;
    setResync({ busy: true, message: '' });
    try {
      const result = await window.electronAPI.resyncConversation(conversationId);
      const count = result.updated === 1 ? '1 mensaje actualizado' : `${result.updated} mensajes actualizados`;
      const note =
        result.localCount === result.remoteCount
          ? ''
          : ` (aquí hay ${result.localCount} mensajes y DeepSeek tiene ${result.remoteCount})`;
      setResync({ busy: false, message: `${count}${note}` });
    } catch (resyncError) {
      setResync({ busy: false, message: cleanError(resyncError) });
    }
  };

  const scriptVoice = useScriptVoice(activeId, messages);
  const flow = useFlowCharacters(activeId, conversations.find((item) => item.id === activeId)?.title ?? '', isConnected);

  const isBusy = pending !== null;
  const isWaiting = isBusy && pending.conversationId === activeId;
  const savedKeys = new Set(
    savedIdeas.filter((item) => item.conversationId === activeId).map((item) => `${item.messageId}:${item.number}`),
  );
  const placeholder = isConnected
    ? 'Message DeepSeek (Enter to send, Shift+Enter for a new line)'
    : 'Waiting for the browser extension…';

  return (
    <div className="chat">
      <ConversationList
        conversations={conversations}
        activeId={activeId}
        isLocked={isBusy}
        onSelect={openConversation}
        onNew={() => openConversation(null)}
        onDelete={handleDelete}
        onRename={handleRename}
      />

      <section className="chat__main">
        <div className={`chat__status${isConnected ? ' chat__status--on' : ''}`}>
          <span className="chat__status-dot" />
          {isConnected ? 'Extension connected' : 'Extension not connected — install it from the extension folder'}
          {activeId && (
            <button
              type="button"
              className="chat__resync"
              disabled={!activeUrl || isBusy || resync.busy || !isConnected}
              title={activeUrl ? 'Vuelve a leer las respuestas desde el historial de DeepSeek' : 'Esta conversación aún no tiene un chat de DeepSeek'}
              onClick={handleResync}
            >
              {resync.busy ? 'Resincronizando…' : 'Resincronizar con DeepSeek'}
            </button>
          )}
          {resync.message && <span className="chat__resync-result">{resync.message}</span>}
        </div>

        <MessageList
          messages={messages}
          streamingText={isWaiting ? pending.text : ''}
          isWaiting={isWaiting}
          error={error}
          savedKeys={savedKeys}
          canSend={!isBusy && isConnected}
          onSend={handleSend}
          onToggleIdea={handleToggleIdea}
          onChooseIdea={handleChooseIdea}
          scriptVoice={scriptVoice}
          flow={flow}
          onOpenTimeline={onOpenTimeline}
          onOpenSettings={onOpenSettings}
        />

        <PromptPresets
          disabled={isBusy || !isConnected}
          hasActiveConversation={activeId !== null}
          onSend={handlePreset}
          onSendConnectors={handleSend}
        />
        <Composer disabled={isBusy || !isConnected} placeholder={placeholder} onSend={handleSend} />
      </section>
    </div>
  );
}
