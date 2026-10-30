// The Now playing panel: the song's disc turning under the comb, the song's details, a WAV download and the mixer.
// A column on wide screens, a drawer on tablets, and a full-screen sheet on phones (where it also carries the seek bar and transport).

import { songDisc } from '../disc.ts';
import { formatMeter, formatTime } from '../format.ts';
import { usePlayer, usePlayerState } from '../usePlayer.ts';
import { DiscPlayer } from './DiscPlayer.tsx';
import { DownloadButton } from './DownloadButton.tsx';
import { IconButton } from './IconButton.tsx';
import { CloseIcon, VisualizerIcon } from './Icons.tsx';
import { Spinner } from './Indicators.tsx';
import { Mixer } from './Mixer.tsx';
import { ProgressBar } from './ProgressBar.tsx';
import { Transport } from './Transport.tsx';

interface NowPlayingPanelProps {
  onClose: () => void;
  /** Open the full-screen visualizer */
  onVisualizer: () => void;
}

export function NowPlayingPanel({ onClose, onVisualizer }: NowPlayingPanelProps) {
  const { analyser } = usePlayer();
  const song = usePlayerState((s) => s.song);
  const playlist = usePlayerState((s) => s.playlist);
  const loading = usePlayerState((s) => s.status === 'loading');
  if (!song || !playlist) return null;
  const { title, description, bpm, meter } = song.song;

  return (
    <aside className="panel" aria-label="Now playing">
      <header className="panel__header">
        <h2 className="label">Now playing</h2>
        <div className="panel__actions">
          <IconButton label="Visualizer (F)" onClick={onVisualizer}>
            <VisualizerIcon />
          </IconButton>
          <IconButton label="Close Now playing" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </div>
      </header>

      <div className="panel__disc">
        <DiscPlayer disc={songDisc(song.song)} duration={song.duration} analyser={analyser} />
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
          <dt className="label">Tempo</dt>
          <dd>{bpm} BPM</dd>
        </div>
        <div>
          <dt className="label">Meter</dt>
          <dd>{formatMeter(meter)}</dd>
        </div>
        <div>
          <dt className="label">Length</dt>
          <dd>{formatTime(song.duration)}</dd>
        </div>
      </dl>
      <DownloadButton key={song.id} song={song.song} />
      <Mixer song={song} />
    </aside>
  );
}
