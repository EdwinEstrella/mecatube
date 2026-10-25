import { useCallback, useEffect, useState } from 'react';
import VoiceOverEditor from './voice/VoiceOverEditor.jsx';
import VoiceOverHistory from './voice/VoiceOverHistory.jsx';
import { cleanIpcError } from './voice/constants.js';
import { extractNarration } from './voice/narration.js';
import { voiceoverText } from './voice/creditsText.js';
import { FALLBACK_PREFS, useVoicePrefs } from './voice/useVoicePrefs.js';

const DRAFT_KEY = 'mecatube.voiceover.draft';

function loadDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}');
    return {
      text: typeof draft.text === 'string' ? draft.text : '',
      title: typeof draft.title === 'string' ? draft.title : '',
      clean: draft.clean === true,
    };
  } catch {
    return { text: '', title: '', clean: false };
  }
}

// Container: standalone voice-over. Paste a script, generate, and keep a history of the results.
export default function VoiceOverView({ onOpenSettings }) {
  const api = window.electronAPI;
  const prefs = useVoicePrefs();
  const [draft, setDraft] = useState(loadDraft);
  const [configured, setConfigured] = useState(null);
  const [voiceId, setVoiceId] = useState(FALLBACK_PREFS.voiceId);
  const [voiceName, setVoiceName] = useState(FALLBACK_PREFS.voiceName);
  const [model, setModel] = useState(FALLBACK_PREFS.model);
  const [phase, setPhase] = useState('idle');
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  const sent = voiceoverText(draft.text, draft.clean, extractNarration);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Draft persistence is a convenience
    }
  }, [draft]);

  useEffect(() => {
    if (!prefs) return;
    setVoiceId(prefs.voiceId);
    setVoiceName(prefs.voiceName);
    setModel(prefs.model);
  }, [prefs]);

  const refresh = useCallback(() => {
    api?.listVoiceovers().then(setItems, (listError) => setError(cleanIpcError(listError)));
  }, [api]);

  useEffect(() => {
    if (!api) return undefined;
    refresh();
    api.getCartesiaStatus().then((status) => setConfigured(status.configured), () => setConfigured(false));
    api.getVoiceBusy().then(setBusy, () => {});
    const offProgress = api.onVoiceProgress((progress) => {
      if (!progress.videoId) setSeconds(progress.seconds);
    });
    const offFinished = api.onVoiceFinished(() => {
      setBusy(false);
      refresh();
    });
    return () => {
      offProgress();
      offFinished();
    };
  }, [api, refresh]);

  const handleGenerate = async () => {
    setError('');
    setSeconds(0);
    setBusy(true);
    setPhase('generating');
    try {
      await api.generateVoiceover({ title: draft.title, text: sent, voiceId, voiceName: voiceName || voiceId, model });
    } catch (generateError) {
      setError(cleanIpcError(generateError));
    } finally {
      setPhase('idle');
      setBusy(false);
      refresh();
    }
  };

  const run = (action) => action().catch((actionError) => setError(cleanIpcError(actionError)));

  const handleDelete = async (id) => {
    await run(() => api.deleteVoiceover(id));
    refresh();
  };

  return (
    <div className="settings voiceover">
      <h1 className="settings__title">Voice-over</h1>
      <p className="settings__card-text">Paste any script and turn it into a voice-over with Cartesia.</p>

      <VoiceOverEditor
        text={draft.text}
        title={draft.title}
        clean={draft.clean}
        chars={sent.length}
        voiceId={voiceId}
        voiceName={voiceName}
        model={model}
        configured={configured}
        busyElsewhere={busy && phase === 'idle'}
        phase={phase}
        seconds={seconds}
        error={error}
        onTextChange={(text) => setDraft((current) => ({ ...current, text }))}
        onTitleChange={(title) => setDraft((current) => ({ ...current, title }))}
        onCleanChange={(clean) => setDraft((current) => ({ ...current, clean }))}
        onVoiceChange={(chosen) => {
          setVoiceId(chosen.id);
          setVoiceName(chosen.name);
        }}
        onModelChange={setModel}
        onRequest={() => setPhase('confirm')}
        onConfirm={handleGenerate}
        onCancelConfirm={() => setPhase('idle')}
        onCancelGeneration={() => api.cancelVoice()}
        onOpenSettings={onOpenSettings}
      />

      <h2 className="settings__card-title">History</h2>
      <VoiceOverHistory
        items={items}
        onOpenFolder={(id) => run(() => api.openVoiceoverFolder(id))}
        onCopy={(item) => run(() => navigator.clipboard.writeText(item.transcript ?? ''))}
        onReuse={(item) => setDraft({ text: item.transcript ?? '', title: item.title ?? '', clean: false })}
        onDelete={handleDelete}
      />
    </div>
  );
}
