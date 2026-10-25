import { useEffect, useRef, useState } from 'react';
import { extractNarration } from '../voice/narration.js';

// Copies only the spoken script (no title, labels or closing question), the same text the voice-over uses
export default function CopyScriptButton({ text }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(extractNarration(text) || text)
      .then(() => {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <button type="button" className="chat-copy-script" onClick={handleCopy}>
      {copied ? 'Guion copiado' : 'Copiar guion'}
    </button>
  );
}
