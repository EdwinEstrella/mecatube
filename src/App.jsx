import { useCallback, useState } from 'react';
import TitleBar from './TitleBar.jsx';
import Sidebar from './Sidebar.jsx';
import ChatView from './ChatView.jsx';
import IdeasView from './IdeasView.jsx';
import TimelineView from './TimelineView.jsx';
import SettingsView from './SettingsView.jsx';
import VoiceOverView from './VoiceOverView.jsx';
import ErrorBoundary from './ui/ErrorBoundary.jsx';

export default function App() {
  const [activeView, setActiveView] = useState('chat');
  // Conversation another view asked the chat to open; cleared once ChatView has taken it
  const [pendingConversationId, setPendingConversationId] = useState(null);
  // Preset send another view asked the chat to run: { type: 'send-preset', presetId, videoId, role }
  const [pendingAction, setPendingAction] = useState(null);
  // Video the Timeline should open expanded; cleared once TimelineView has taken it
  const [pendingVideoId, setPendingVideoId] = useState(null);

  const handleOpenChat = (conversationId) => {
    setPendingConversationId(conversationId);
    setActiveView('chat');
  };
  const clearPending = useCallback(() => setPendingConversationId(null), []);

  const handleChatAction = (action) => {
    setPendingAction(action);
    setActiveView('chat');
  };
  const clearAction = useCallback(() => setPendingAction(null), []);

  const handleOpenTimeline = (videoId) => {
    setPendingVideoId(videoId);
    setActiveView('timeline');
  };
  const clearVideo = useCallback(() => setPendingVideoId(null), []);

  return (
    <div className="layout">
      <TitleBar />

      <div className="workspace">
        <Sidebar activeView={activeView} onNavigate={setActiveView} />

        <main className="app">
          <ErrorBoundary>
          {activeView === 'chat' && (
            <ChatView
              initialConversationId={pendingConversationId}
              onInitialConsumed={clearPending}
              pendingAction={pendingAction}
              onActionConsumed={clearAction}
              onOpenTimeline={handleOpenTimeline}
              onOpenSettings={() => setActiveView('settings')}
            />
          )}
          {activeView === 'ideas' && <IdeasView onOpenChat={handleOpenChat} />}
          {activeView === 'timeline' && (
            <TimelineView
              onOpenChat={handleOpenChat}
              onChatAction={handleChatAction}
              initialVideoId={pendingVideoId}
              onInitialConsumed={clearVideo}
            />
          )}
          {activeView === 'voiceover' && <VoiceOverView onOpenSettings={() => setActiveView('settings')} />}
          {activeView === 'settings' && <SettingsView />}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
