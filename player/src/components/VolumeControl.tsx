// Volume: a mute button that remembers the level it muted, and a slider.

import { useRef } from 'react';
import { usePlayer, usePlayerState } from '../usePlayer.ts';
import { IconButton } from './IconButton.tsx';
import { VolumeIcon } from './Icons.tsx';
import { Slider } from './Slider.tsx';

const KEY_STEP = 0.05;

export function VolumeControl() {
  const player = usePlayer();
  const volume = usePlayerState((s) => s.volume);
  /** The level to come back to when unmuting */
  const restore = useRef(volume);

  const toggleMute = () => {
    if (volume > 0) restore.current = volume;
    player.setVolume(volume > 0 ? 0 : restore.current);
  };

  return (
    <div className="volume">
      <IconButton label={volume === 0 ? 'Unmute' : 'Mute'} onClick={toggleMute}>
        <VolumeIcon level={volume} />
      </IconButton>
      <Slider
        label="Volume"
        value={volume}
        max={1}
        step={KEY_STEP}
        valueText={`${Math.round(volume * 100)}%`}
        onChange={(level) => player.setVolume(level)}
      />
    </div>
  );
}
