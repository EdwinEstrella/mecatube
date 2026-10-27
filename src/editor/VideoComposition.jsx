// Remotion composition for rendering edited video with camera motion and subtitles.
// Uses TransitionSeries for scene transitions and interpolate for camera effects.

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Video, Audio } from '@remotion/media';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { buildPlan, activeSubtitle, PUNCH_FRAMES } from './plan.js';

export { compositionSize } from './plan.js';

function Shot({ item, src }) {
  const frame = useCurrentFrame();
  const duration = Math.max(1, item.sequenceFrames);

  let baseScale = 1;
  let translate;

  switch (item.motion) {
    case 'zoom-in':
      baseScale = interpolate(frame, [0, duration], [1, 1.12], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      break;
    case 'zoom-out':
      baseScale = interpolate(frame, [0, duration], [1.12, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      break;
    case 'pan-left': {
      baseScale = 1.12;
      const x = interpolate(frame, [0, duration], [3, -3], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      translate = `${x}% 0%`;
      break;
    }
    case 'pan-right': {
      baseScale = 1.12;
      const x = interpolate(frame, [0, duration], [-3, 3], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      translate = `${x}% 0%`;
      break;
    }
    case 'none':
    default:
      baseScale = 1;
      break;
  }

  const punchMultiplier = item.punchIn
    ? interpolate(frame, [0, PUNCH_FRAMES], [1.15, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  const motionStyle = {
    scale: baseScale * punchMultiplier,
    ...(translate ? { translate } : {}),
  };

  return (
    <AbsoluteFill style={motionStyle}>
      {src ? (
        <Video
          src={src}
          muted
          loop={item.loop}
          playbackRate={item.playbackRate}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <AbsoluteFill style={{ backgroundColor: '#111111' }} />
      )}
    </AbsoluteFill>
  );
}

function Subtitles({ subtitles }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const active = activeSubtitle(subtitles, frame / fps);
  if (!active || !active.text) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 80,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          color: '#ffffff',
          fontWeight: 'bold',
          fontSize: 56,
          fontFamily: 'Inter, Arial, sans-serif',
          textAlign: 'center',
          textShadow: '0 2px 6px #000000, 0 0 12px #000000',
          WebkitTextStroke: '2px #000000',
          lineHeight: 1.25,
        }}
      >
        {active.text}
      </div>
    </div>
  );
}

export default function VideoComposition({
  edl,
  sources = {},
  audioUrl,
  clipDurations = {},
}) {
  const { fps } = useVideoConfig();
  const plan = buildPlan(edl, { fps, clipDurations });

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {plan && plan.items.length > 0 && (
        <TransitionSeries>
          {plan.items.map((item) => (
            <React.Fragment key={item.key}>
              {item.transitionIn && (
                <TransitionSeries.Transition
                  presentation={
                    item.transitionIn.type === 'fade'
                      ? fade()
                      : slide({ direction: 'from-right' })
                  }
                  timing={linearTiming({
                    durationInFrames: item.transitionIn.frames,
                  })}
                />
              )}
              <TransitionSeries.Sequence durationInFrames={item.sequenceFrames}>
                <Shot item={item} src={sources?.[item.number]} />
              </TransitionSeries.Sequence>
            </React.Fragment>
          ))}
        </TransitionSeries>
      )}
      {audioUrl && <Audio src={audioUrl} />}
      <Subtitles subtitles={edl?.subtitles} />
    </AbsoluteFill>
  );
}
