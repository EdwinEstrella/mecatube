import { useEffect, useRef, useState } from 'react';

// Copies the whole script message exactly as DeepSeek delivered it (Markdown included)
export default function CopyScriptButton({ text }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(text)
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
