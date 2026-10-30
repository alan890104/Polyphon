// The Now playing panel: a large cover with a live spectrum, the song's details, a WAV download and the mixer.
// A column on wide screens, a drawer on tablets, and a full-screen sheet on phones (where it also carries the seek bar and transport).

import { artFor } from '../art.ts';
import { formatMeter, formatTime } from '../format.ts';
import { usePlayer, usePlayerState } from '../usePlayer.ts';
import { Cover } from './Cover.tsx';
import { DownloadButton } from './DownloadButton.tsx';
import { IconButton } from './IconButton.tsx';
import { CloseIcon } from './Icons.tsx';
import { Spinner } from './Indicators.tsx';
import { Mixer } from './Mixer.tsx';
import { ProgressBar } from './ProgressBar.tsx';
import { Transport } from './Transport.tsx';
import { Visualizer } from './Visualizer.tsx';

export function NowPlayingPanel({ onClose }: { onClose: () => void }) {
  const { analyser } = usePlayer();
  const song = usePlayerState((s) => s.song);
  const playlist = usePlayerState((s) => s.playlist);
  const loading = usePlayerState((s) => s.status === 'loading');
  if (!song || !playlist) return null;
  const { title, description, bpm, meter } = song.song;

  return (
    <aside className="panel" aria-label="Now playing" style={{ '--hue': artFor(song.id).hue }}>
      <header className="panel__header">
        <h2 className="panel__heading">Now playing</h2>
        <IconButton label="Close Now playing" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </header>

      <div className="panel__art">
        <Cover id={song.id} />
        {analyser && <Visualizer analyser={analyser} />}
        {loading && (
          <p className="panel__loading">
            <Spinner />
            Preparing samples…
          </p>
        )}
      </div>

      <div className="panel__titles">
        <h3 className="panel__title">{title}</h3>
        <p className="panel__playlist">{playlist.title}</p>
      </div>

      <div className="panel__transport">
        <ProgressBar />
        <Transport />
      </div>

      {description && <p className="panel__description">{description}</p>}
      <dl className="facts">
        <div>
          <dt>Tempo</dt>
          <dd>{bpm} BPM</dd>
        </div>
        <div>
          <dt>Meter</dt>
          <dd>{formatMeter(meter)}</dd>
        </div>
        <div>
          <dt>Length</dt>
          <dd>{formatTime(song.duration)}</dd>
        </div>
      </dl>
      <DownloadButton key={song.id} song={song.song} />
      <Mixer song={song} />
    </aside>
  );
}
