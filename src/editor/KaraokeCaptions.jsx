// Animated TikTok/YouTube-style karaoke captions driven by narration per-word timestamps.
import '@fontsource/montserrat/900.css';
import React, { useMemo } from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { buildCaptionPages, activePage, activeWordIndex } from './captions.js';

function Word({ word, index, activeIndex, highlightColor }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isCurrent = index === activeIndex;
  const isSpoken = activeIndex >= 0 && index < activeIndex;

  let color = '#ffffff';
  let opacity = 0.85;
  let scale = 1;

  if (isCurrent) {
    color = highlightColor;
    opacity = 1;

    const wordStartFrame = Math.round(word.start * fps);
    // Pop from 1.0 to 1.15 at word start, then settle to 1.08
    scale = interpolate(frame - wordStartFrame, [0, 4, 8], [1, 1.15, 1.08], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  } else if (isSpoken) {
    color = '#ffffff';
    opacity = 1;
    scale = 1;
  }

  return (
    <span
      style={{
        display: 'inline-block',
        color,
        opacity,
        scale,
      }}
    >
      {word.text}
    </span>
  );
}

function Page({ page, pageIndex }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;

  const pageStartFrame = Math.round(page.start * fps);
  const pageProgress = spring({
    frame: Math.max(0, frame - pageStartFrame),
    fps,
    durationInFrames: 6,
  });

  const pageScale = interpolate(pageProgress, [0, 1], [0.85, 1]);
  const pageOpacity = interpolate(pageProgress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const activeIndex = activeWordIndex(page, seconds);
  const highlightColor = pageIndex % 3 === 2 ? '#2BFF88' : '#FFE600';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 140,
        left: '50%',
        translate: '-50% 0',
        width: '100%',
        maxWidth: '85%',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '0 18px',
        pointerEvents: 'none',
        scale: pageScale,
        opacity: pageOpacity,
        fontFamily: 'Montserrat',
        fontWeight: 900,
        fontSize: 86,
        textTransform: 'uppercase',
        letterSpacing: 1,
        lineHeight: 1.15,
        WebkitTextStroke: '12px #000',
        paintOrder: 'stroke fill',
        textShadow: '0 6px 18px rgba(0,0,0,0.55)',
      }}
    >
      {page.words.map((word, index) => (
        <Word
          key={`${index}-${word.start}`}
          word={word}
          index={index}
          activeIndex={activeIndex}
          highlightColor={highlightColor}
        />
      ))}
    </div>
  );
}

function ActiveCaption({ pages }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;

  const page = activePage(pages, seconds);
  if (!page) {
    return null;
  }

  const pageIndex = pages.indexOf(page);
  return <Page key={page.start} page={page} pageIndex={pageIndex} />;
}

export default function KaraokeCaptions({ words }) {
  const pages = useMemo(() => buildCaptionPages(words), [words]);

  if (!pages || pages.length === 0) {
    return null;
  }

  return <ActiveCaption pages={pages} />;
}
