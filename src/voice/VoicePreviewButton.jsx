import { useState, useRef, useEffect } from 'react';

// Pure audio preview button for Cartesia voice IDs.
// Fetches previewUrl via lookupVoice and plays/stops with a ▶ / ■ button.
export default function VoicePreviewButton({ voiceId, className = '' }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);
  const cachedUrlRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    cachedUrlRef.current = null;
  }, [voiceId]);

  const togglePreview = async (event) => {
    event.stopPropagation();
    if (!voiceId || !window.electronAPI) return;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    try {
      setIsLoading(true);
      let url = cachedUrlRef.current;
      if (!url) {
        const voiceData = await window.electronAPI.lookupVoice(voiceId);
        url = voiceData?.previewUrl || null;
        cachedUrlRef.current = url;
      }

      if (!url) {
        setIsLoading(false);
        return;
      }

      if (!audioRef.current) {
        const audio = new Audio(url);
        audio.onended = () => setIsPlaying(false);
        audio.onpause = () => setIsPlaying(false);
        audioRef.current = audio;
      } else {
        audioRef.current.src = url;
      }

      await audioRef.current.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (!voiceId) return null;

  const buttonClass = `voice-row__play ${className}`.trim();
  const label = isPlaying ? 'Detener vista previa' : 'Reproducir vista previa';

  return (
    <button
      type="button"
      className={buttonClass}
      title={label}
      aria-label={label}
      disabled={isLoading}
      onClick={togglePreview}
    >
      {isLoading ? '…' : isPlaying ? '■' : '▶'}
    </button>
  );
}
