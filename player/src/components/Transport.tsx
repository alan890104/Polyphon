// The transport: shuffle, previous, play / pause, next and repeat. On phones the bar keeps only the play button.

import { usePlayer, usePlayerState } from '../usePlayer.ts';
import { IconButton } from './IconButton.tsx';
import { NextIcon, PauseIcon, PlayIcon, PreviousIcon, RepeatIcon, RepeatOneIcon, ShuffleIcon } from './Icons.tsx';
import { Spinner } from './Indicators.tsx';

export function Transport() {
  const player = usePlayer();
  const ready = usePlayerState((s) => s.song !== null);
  const shuffle = usePlayerState((s) => s.shuffle);
  const repeat = usePlayerState((s) => s.repeat);

  return (
    <div className="transport">
      <IconButton className="toggle-button transport__extra" label="Shuffle" pressed={shuffle} onClick={() => player.setShuffle(!shuffle)}>
        <ShuffleIcon />
      </IconButton>
      <IconButton className="icon-button transport__extra" label="Previous" disabled={!ready} onClick={() => player.previous()}>
        <PreviousIcon />
      </IconButton>
      <PlayButton />
      <IconButton className="icon-button transport__extra" label="Next" disabled={!ready} onClick={() => player.next()}>
        <NextIcon />
      </IconButton>
      <IconButton
        className="toggle-button transport__extra"
        label={repeat === 'one' ? 'Repeat one' : 'Repeat'}
        pressed={repeat !== 'off'}
        onClick={() => player.cycleRepeat()}
      >
        {repeat === 'one' ? <RepeatOneIcon /> : <RepeatIcon />}
      </IconButton>
    </div>
  );
}

function PlayButton() {
  const player = usePlayer();
  const status = usePlayerState((s) => (s.song ? s.status : null));
  const playing = status === 'playing';
  return (
    <IconButton className="play-button" label={playing ? 'Pause' : 'Play'} disabled={!status} onClick={() => player.toggle()}>
      {status === 'loading' ? <Spinner /> : playing ? <PauseIcon /> : <PlayIcon />}
    </IconButton>
  );
}
