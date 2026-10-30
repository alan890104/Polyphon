// The bar along the bottom: the current song, the transport and seek bar, volume, and the button for the Now playing panel.
// On phones it shrinks to the cover, the title and the play button under a thin progress line; tapping the song opens the panel.

import { artFor } from '../art.ts';
import { usePlayerState } from '../usePlayer.ts';
import { Cover } from './Cover.tsx';
import { IconButton } from './IconButton.tsx';
import { PanelIcon } from './Icons.tsx';
import { ProgressBar, ProgressLine } from './ProgressBar.tsx';
import { Transport } from './Transport.tsx';
import { VolumeControl } from './VolumeControl.tsx';

interface NowPlayingBarProps {
  panelOpen: boolean;
  onTogglePanel: () => void;
}

export function NowPlayingBar({ panelOpen, onTogglePanel }: NowPlayingBarProps) {
  const song = usePlayerState((s) => s.song);
  const playlist = usePlayerState((s) => s.playlist);
  const error = usePlayerState((s) => s.error);

  return (
    <footer className="bar" aria-label="Player" style={song ? { '--hue': artFor(song.id).hue } : undefined}>
      <ProgressLine />
      {song && playlist ? (
        <button type="button" className="now" aria-label={`${song.song.title}: Now playing`} aria-expanded={panelOpen} onClick={onTogglePanel}>
          <span className="now__cover">
            <Cover id={song.id} />
          </span>
          <span className="now__text">
            <span className="now__title">{song.song.title}</span>
            {error ? <span className="now__subtitle now__subtitle--error">Couldn't play: {error}</span> : <span className="now__subtitle">{playlist.title}</span>}
          </span>
        </button>
      ) : (
        <div className="now">
          <span className="now__cover now__cover--empty" />
          <span className="now__text">
            <span className="now__title">Nothing playing</span>
            <span className="now__subtitle">Pick a song to start</span>
          </span>
        </div>
      )}
      <div className="bar__center">
        <Transport />
        <ProgressBar />
      </div>
      <div className="bar__side">
        <IconButton className="toggle-button" label="Now playing" pressed={panelOpen} disabled={!song} onClick={onTogglePanel}>
          <PanelIcon />
        </IconButton>
        <VolumeControl />
      </div>
    </footer>
  );
}
