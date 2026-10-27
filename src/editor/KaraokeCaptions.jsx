// Animated TikTok/YouTube-style karaoke captions driven by narration per-word timestamps.
import './fonts.js';
import React, { useMemo } from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { buildCaptionPages, activePage, activeWordIndex } from './captions.js';
import { normalizeCaptionStyle, captionCss } from './captionStyle.js';

function isLightColor(hex) {
  if (!hex || typeof hex !== 'string') return true;
  const c = hex.replace('#', '');
  if (c.length !== 6) return true;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

function TypewriterText({ text, charStartIndex, totalLetters, pageStart, pageEnd }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pageStartFrame = Math.round(pageStart * fps);
  const blockDurationSec = Math.max(0.1, pageEnd - pageStart);
  const revealDurationSec = Math.min(0.6, blockDurationSec * 0.5);
  const revealDurationFrames = Math.max(1, Math.round(revealDurationSec * fps));

  const diff = frame - pageStartFrame;
  const progress = interpolate(diff, [0, revealDurationFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const revealedLetters = Math.floor(progress * totalLetters);

  return (
    <>
      {text.split('').map((char, idx) => {
        const letterIndex = charStartIndex + idx;
        const visible = progress >= 1 || letterIndex < revealedLetters;
        return (
          <span
            key={idx}
            style={{
              opacity: visible ? 1 : 0,
            }}
          >
            {char}
          </span>
        );
      })}
    </>
  );
}

function Word({
  word,
  index,
  activeIndex,
  highlightColor,
  textColor,
  strokeColor,
  strokeWidth,
  baseTextShadow,
  shadow,
  size,
  wordEffect,
  pageEffect,
  charStartIndex,
  totalLetters,
  pageStart,
  pageEnd,
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isCurrent = index === activeIndex;
  const isSpoken = activeIndex >= 0 && index < activeIndex;

  let color = textColor;
  let opacity = 0.85;
  let scale = 1;
  let translateY = 0;
  let rotate = 0;
  let textShadow;
  let textStroke;
  let boxScale = 1;
  let underlineWidthPercent = 0;

  if (isCurrent) {
    color = highlightColor;
    opacity = 1;

    const wordStartFrame = Math.round(word.start * fps);
    const diff = Math.max(0, frame - wordStartFrame);

    if (wordEffect === 'pop') {
      // Pop from 1.0 to 1.15 at word start, then settle to 1.08
      scale = interpolate(diff, [0, 4, 8], [1, 1.15, 1.08], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    } else if (wordEffect === 'bounce') {
      // Translate Y -14px and back with a spring
      const spr = spring({
        frame: diff,
        fps,
        durationInFrames: 8,
      });
      translateY = interpolate(spr, [0, 0.45, 1], [0, -14, 0]);
    } else if (wordEffect === 'shake') {
      // Small rotate +-4deg oscillation over the first 8 frames
      rotate = interpolate(diff, [0, 2, 4, 6, 8], [0, -4, 4, -2, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    } else if (wordEffect === 'glow') {
      // TextShadow glow in highlight color, intensity pulsing in first 8 frames then steady
      const glowRadius = interpolate(diff, [0, 3, 6, 8], [0, 28, 14, 20], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      const glowShadow = `0 0 ${glowRadius}px ${highlightColor}, 0 0 ${Math.round(glowRadius * 1.5)}px ${highlightColor}`;
      const effectiveBaseShadow =
        baseTextShadow !== undefined
          ? (baseTextShadow !== 'none' ? baseTextShadow : null)
          : (shadow ? '0 6px 18px rgba(0,0,0,0.55)' : null);
      textShadow = effectiveBaseShadow ? `${glowShadow}, ${effectiveBaseShadow}` : glowShadow;
    } else if (wordEffect === 'underline') {
      // A highlight-colored bar under the word growing 0 -> 100% width over 5 frames
      underlineWidthPercent = interpolate(diff, [0, 5], [0, 100], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    } else if (wordEffect === 'box') {
      // Rounded highlight-colored background box behind the word
      // Text color switches to stroke color, black text if highlight is light; box scales in 0.8 -> 1
      color = isLightColor(highlightColor) ? '#000000' : strokeColor;
      textStroke = 'none';
      boxScale = interpolate(diff, [0, 6], [0.8, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }
  } else if (isSpoken) {
    color = textColor;
    opacity = 1;
    scale = 1;
  }

  const wordInner =
    pageEffect === 'typewriter' ? (
      <TypewriterText
        text={word.text}
        charStartIndex={charStartIndex}
        totalLetters={totalLetters}
        pageStart={pageStart}
        pageEnd={pageEnd}
      />
    ) : (
      word.text
    );

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        color,
        opacity,
        scale,
        translate: translateY !== 0 ? `0px ${translateY}px` : undefined,
        rotate: rotate !== 0 ? `${rotate}deg` : undefined,
        ...(textShadow !== undefined ? { textShadow } : {}),
        ...(textStroke !== undefined ? { WebkitTextStroke: textStroke } : {}),
      }}
    >
      {isCurrent && wordEffect === 'box' && (
        <span
          style={{
            position: 'absolute',
            inset: '-4px -10px',
            backgroundColor: highlightColor,
            borderRadius: Math.max(6, Math.round(size * 0.12)),
            scale: boxScale,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      )}
      {isCurrent && wordEffect === 'underline' && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            bottom: -4,
            width: `${underlineWidthPercent}%`,
            height: Math.max(4, Math.round(size * 0.08)),
            backgroundColor: highlightColor,
            borderRadius: 2,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      )}
      <span style={{ position: 'relative', zIndex: 1 }}>{wordInner}</span>
    </span>
  );
}

function PageEnter({ page, pageEffect, children }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pageStartFrame = Math.round(page.start * fps);
  const diff = Math.max(0, frame - pageStartFrame);

  let scale = 1;
  let opacity = 1;
  let translateY = 0;
  let filter = 'none';

  if (pageEffect === 'pop') {
    const pageProgress = spring({
      frame: diff,
      fps,
      durationInFrames: 6,
    });
    scale = interpolate(pageProgress, [0, 1], [0.85, 1]);
    opacity = interpolate(pageProgress, [0, 1], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  } else if (pageEffect === 'fade') {
    opacity = interpolate(diff, [0, 7], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  } else if (pageEffect === 'slide-up') {
    const slideProgress = spring({
      frame: diff,
      fps,
      durationInFrames: 7,
    });
    translateY = interpolate(slideProgress, [0, 1], [35, 0]);
    opacity = interpolate(diff, [0, 6], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  } else if (pageEffect === 'zoom') {
    scale = interpolate(diff, [0, 7], [1.6, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    opacity = interpolate(diff, [0, 5], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  } else if (pageEffect === 'blur') {
    const blurPx = interpolate(diff, [0, 8], [12, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    filter = blurPx > 0.05 ? `blur(${blurPx}px)` : 'none';
    opacity = interpolate(diff, [0, 6], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '0 18px',
        width: '100%',
        scale,
        opacity,
        translate: translateY !== 0 ? `0px ${translateY}px` : undefined,
        filter: filter !== 'none' ? filter : undefined,
      }}
    >
      {children}
    </div>
  );
}

function Page({ page, pageIndex, style }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;

  const activeIndex = activeWordIndex(page, seconds);
  const highlightColor = pageIndex % 3 === 2 ? style.altHighlightColor : style.highlightColor;

  const positionStyles = {
    top: style.position === 'top' ? 120 : style.position === 'middle' ? '50%' : 'auto',
    bottom: style.position === 'bottom' ? 140 : 'auto',
    translate: style.position === 'middle' ? '-50% -50%' : '-50% 0',
  };

  const css = captionCss(style);

  let totalLetters = 0;
  const charOffsets = page.words.map((w) => {
    const offset = totalLetters;
    totalLetters += (w.text || '').length;
    return offset;
  });

  return (
    <div
      style={{
        position: 'absolute',
        ...positionStyles,
        left: '50%',
        width: style.shadowType === 'box' ? 'fit-content' : '100%',
        maxWidth: '85%',
        pointerEvents: 'none',
        ...css,
      }}
    >
      <PageEnter page={page} pageEffect={style.pageEffect}>
        {page.words.map((word, index) => (
          <Word
            key={`${index}-${word.start}`}
            word={word}
            index={index}
            activeIndex={activeIndex}
            highlightColor={highlightColor}
            textColor={style.textColor}
            strokeColor={style.strokeColor}
            strokeWidth={style.strokeWidth}
            baseTextShadow={css.textShadow}
            shadow={style.shadowType !== 'none'}
            size={style.size}
            wordEffect={style.wordEffect}
            pageEffect={style.pageEffect}
            charStartIndex={charOffsets[index]}
            totalLetters={totalLetters}
            pageStart={page.start}
            pageEnd={page.end}
          />
        ))}
      </PageEnter>
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
