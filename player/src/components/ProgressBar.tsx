// How far the song has played: a seek bar with the elapsed time and the length (the song jumps when the drag ends),
// and the thin line the compact bar shows on phones.

import { useState } from 'react';
import { formatTime } from '../format.ts';
import { usePlayer, usePlayerState } from '../usePlayer.ts';
import { Slider } from './Slider.tsx';

const KEY_STEP = 5;

export function ProgressBar() {
  const player = usePlayer();
  const position = usePlayerState((s) => s.position);
  const duration = usePlayerState((s) => s.song?.duration ?? 0);
  const seekable = usePlayerState((s) => s.song !== null && s.status !== 'loading');
  /** Where the slider is being dragged to, until it is released */
  const [scrub, setScrub] = useState<number | null>(null);
  const shown = scrub ?? position;

  return (
    <div className="progress">
      <span className="progress__time">{formatTime(shown)}</span>
      <Slider
        label="Seek"
        value={shown}
        max={duration}
        step={KEY_STEP}
        valueText={`${formatTime(shown)} of ${formatTime(duration)}`}
        disabled={!seekable}
        onChange={setScrub}
        onCommit={(seconds) => {
          player.seek(seconds);
          setScrub(null);
        }}
      />
      <span className="progress__time">{formatTime(duration)}</span>
    </div>
  );
}

export function ProgressLine() {
  const fraction = usePlayerState((s) => (s.song ? Math.min(1, s.position / s.song.duration) : 0));
  return <div className="progress-line" style={{ '--fraction': fraction }} aria-hidden="true" />;
}
