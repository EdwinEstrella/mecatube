// Animated TikTok/YouTube-style karaoke captions driven by narration per-word timestamps.
import './fonts.js';
import React, { useMemo } from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { buildCaptionPages, activePage, activeWordIndex } from './captions.js';
import { normalizeCaptionStyle, captionCss } from './captionStyle.js';

function Word({ word, index, activeIndex, highlightColor, textColor, animation }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isCurrent = index === activeIndex;
  const isSpoken = activeIndex >= 0 && index < activeIndex;

  let color = textColor;
  let opacity = 0.85;
  let scale = 1;

  if (isCurrent) {
    color = highlightColor;
    opacity = 1;

    if (animation === 'pop') {
      const wordStartFrame = Math.round(word.start * fps);
      // Pop from 1.0 to 1.15 at word start, then settle to 1.08
      scale = interpolate(frame - wordStartFrame, [0, 4, 8], [1, 1.15, 1.08], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }
  } else if (isSpoken) {
    color = textColor;
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

function Page({ page, pageIndex, style }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;

  let pageScale = 1;
  let pageOpacity = 1;

  if (style.animation === 'pop') {
    const pageStartFrame = Math.round(page.start * fps);
    const pageProgress = spring({
      frame: Math.max(0, frame - pageStartFrame),
      fps,
      durationInFrames: 6,
    });
    pageScale = interpolate(pageProgress, [0, 1], [0.85, 1]);
    pageOpacity = interpolate(pageProgress, [0, 1], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }

  const activeIndex = activeWordIndex(page, seconds);
  const highlightColor = pageIndex % 3 === 2 ? style.altHighlightColor : style.highlightColor;

  const positionStyles = {
    top: style.position === 'top' ? 120 : style.position === 'middle' ? '50%' : 'auto',
    bottom: style.position === 'bottom' ? 140 : 'auto',
    translate: style.position === 'middle' ? '-50% -50%' : '-50% 0',
  };

  const css = captionCss(style);

  return (
    <div
      style={{
        position: 'absolute',
        ...positionStyles,
        left: '50%',
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
        ...css,
      }}
    >
      {page.words.map((word, index) => (
        <Word
          key={`${index}-${word.start}`}
          word={word}
          index={index}
          activeIndex={activeIndex}
          highlightColor={highlightColor}
          textColor={style.textColor}
          animation={style.animation}
        />
      ))}
    </div>
  );
}

function ActiveCaption({ pages, style }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;

  const page = activePage(pages, seconds);
  if (!page) {
    return null;
  }

  const pageIndex = pages.indexOf(page);
  return <Page key={page.start} page={page} pageIndex={pageIndex} style={style} />;
}

export default function KaraokeCaptions({ words, style }) {
  const normStyle = useMemo(() => normalizeCaptionStyle(style), [style]);
  const pages = useMemo(
    () => buildCaptionPages(words, { maxWords: normStyle.wordsPerPage }),
    [words, normStyle.wordsPerPage]
  );

  if (!pages || pages.length === 0) {
    return null;
  }

  return <ActiveCaption pages={pages} style={normStyle} />;
}
