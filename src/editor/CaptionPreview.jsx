// Remotion preview composition and player for testing caption styles live against clips or images.
import React, { useMemo } from 'react';
import { AbsoluteFill, Img } from 'remotion';
import { Video } from '@remotion/media';
import { Player } from '@remotion/player';
import KaraokeCaptions from './KaraokeCaptions.jsx';

const DEFAULT_SAMPLE_SENTENCE = 'Nadie sabía qué había debajo del hielo hasta que alguien miró';

export function buildSampleWords(realWords) {
  if (Array.isArray(realWords) && realWords.length > 0) {
    const valid = realWords.filter(
      (w) =>
        w &&
        typeof w.w === 'string' &&
        w.w.trim().length > 0 &&
        typeof w.s === 'number' &&
        typeof w.e === 'number' &&
        w.e >= w.s
    );
    if (valid.length > 0) {
      const slice = valid.slice(0, 12);
      const offset = slice[0].s - 0.3;
      return slice.map((w) => ({
        w: w.w.trim(),
        s: Math.max(0, Math.round((w.s - offset) * 1000) / 1000),
        e: Math.max(0.1, Math.round((w.e - offset) * 1000) / 1000),
      }));
    }
  }

  const tokens = DEFAULT_SAMPLE_SENTENCE.split(/\s+/);
  return tokens.map((token, i) => {
    const s = Math.round((0.3 + i * 0.35) * 1000) / 1000;
    const e = Math.round((s + 0.32) * 1000) / 1000;
    return { w: token, s, e };
  });
}

export const SAMPLE_WORDS = buildSampleWords();

export function CaptionPreviewComposition({ background, backgroundType, style, words }) {
  const effectiveWords = words && words.length > 0 ? words : SAMPLE_WORDS;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0c0c12', overflow: 'hidden' }}>
      {backgroundType === 'video' && background ? (
        <Video
          src={background}
          muted
          loop
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : backgroundType === 'image' && background ? (
        <Img
          src={background}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(circle at 50% 40%, #202236 0%, #12131e 65%, #08080d 100%)',
          }}
        />
      )}
      <KaraokeCaptions words={effectiveWords} style={style} />
    </AbsoluteFill>
  );
}

export default function CaptionPreview({
  background,
  backgroundType = 'video',
  style,
  words,
}) {
  const effectiveWords = useMemo(() => buildSampleWords(words), [words]);
  const lastWord = effectiveWords[effectiveWords.length - 1];
  const durationSeconds = (lastWord?.e ?? 4.15) + 1;
  const durationInFrames = Math.max(1, Math.round(durationSeconds * 30));

  return (
    <div className="auto-edit__caption-preview-player">
      <Player
        component={CaptionPreviewComposition}
        inputProps={{
          background,
          backgroundType,
          style,
          words: effectiveWords,
        }}
        durationInFrames={durationInFrames}
        compositionWidth={1920}
        compositionHeight={1080}
        fps={30}
        loop
        autoPlay
        controls
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      />
    </div>
  );
}
