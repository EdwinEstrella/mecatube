import { motion } from 'motion/react';
import HeartIcon from './chat/HeartIcon.jsx';

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8.5 9h7M8.5 12h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IdeasIcon() {
  return <HeartIcon size={20} />;
}

function TimelineIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="5.5" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.6" fill="#0b0b0f" />
      <circle cx="18.5" cy="12" r="2" stroke="currentColor" strokeWidth="1.6" fill="#0b0b0f" />
      <path d="M4 6.5h9M4 17.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function VoiceOverIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3.5" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5M8.5 20.5h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SidebarButton({ label, isActive, onClick, children }) {
  return (
    <button
      type="button"
      className={`sidebar__button${isActive ? ' sidebar__button--active' : ''}`}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      title={label}
      onClick={onClick}
    >
      {isActive && (
        <motion.span
          layoutId="sidebar-indicator"
          className="sidebar__indicator"
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}
      <span className="sidebar__icon">{children}</span>
      <span className="sidebar__label">{label}</span>
    </button>
  );
}

export default function Sidebar({ activeView, onNavigate }) {
  return (
    <nav className="sidebar" aria-label="Navegación principal">
      <SidebarButton
        label="Chat"
        isActive={activeView === 'chat'}
        onClick={() => onNavigate('chat')}
      >
        <ChatIcon />
      </SidebarButton>

      <SidebarButton
        label="Voz en off"
        isActive={activeView === 'voiceover'}
        onClick={() => onNavigate('voiceover')}
      >
        <VoiceOverIcon />
      </SidebarButton>

      <SidebarButton
        label="Ideas"
        isActive={activeView === 'ideas'}
        onClick={() => onNavigate('ideas')}
      >
        <IdeasIcon />
      </SidebarButton>

      <SidebarButton
        label="Línea de tiempo"
        isActive={activeView === 'timeline'}
        onClick={() => onNavigate('timeline')}
      >
        <TimelineIcon />
      </SidebarButton>

      <div className="sidebar__spacer" />

      <SidebarButton
        label="Configuración"
        isActive={activeView === 'settings'}
        onClick={() => onNavigate('settings')}
      >
        <SettingsIcon />
      </SidebarButton>
    </nav>
  );
}
