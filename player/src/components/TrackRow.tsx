// One song in the playlist table: its number (equalizer bars while it plays, a spinner while it loads), cover, title and
// description, tempo and meter, and length. A song that failed to load is dimmed, with the error on hover.

import type { JukeboxState } from 'polyphon';
import { formatMeter, formatTime } from '../format.ts';
import type { LibraryPlaylist, LibrarySong } from '../library.ts';
import { usePlayer, usePlayerState } from '../usePlayer.ts';
import { Cover } from './Cover.tsx';
import { PauseIcon, PlayIcon, WarningIcon } from './Icons.tsx';
import { Equalizer, Spinner } from './Indicators.tsx';

interface TrackRowProps {
  number: number;
  playlist: LibraryPlaylist;
  entry: LibrarySong;
}

export function TrackRow({ number, playlist, entry }: TrackRowProps) {
  const player = usePlayer();
  const status = usePlayerState((s) => (s.song === entry ? s.status : null));

  if (entry.status === 'broken') {
    return (
      <li>
        <div className="track" data-broken="" title={entry.error}>
          <span className="track__index">
            <WarningIcon />
          </span>
          <Columns id={entry.id} title={entry.id} description={entry.error} tempo="–" length="–" />
        </div>
      </li>
    );
  }

  const { title, description = '', bpm, meter } = entry.song;
  const playing = status === 'playing';
  return (
    <li>
      <button
        type="button"
        className="track"
        data-status={status ?? undefined}
        aria-current={status ? 'true' : undefined}
        aria-label={`${playing ? 'Pause' : 'Play'} ${title}`}
        onClick={() => (status ? player.toggle() : player.play(playlist, entry))}
      >
        <span className="track__index">
          <Indicator number={number} status={status} />
          <span className="track__action">{playing ? <PauseIcon /> : <PlayIcon />}</span>
        </span>
        <Columns id={entry.id} title={title} description={description} tempo={`${bpm} BPM · ${formatMeter(meter)}`} length={formatTime(entry.duration)} />
      </button>
    </li>
  );
}

function Indicator({ number, status }: { number: number; status: JukeboxState | null }) {
  if (status === 'loading') return <Spinner />;
  if (status === 'playing') return <Equalizer />;
  return <span className="track__number">{number}</span>;
}

interface ColumnsProps {
  id: string;
  title: string;
  description: string;
  tempo: string;
  length: string;
}

function Columns({ id, title, description, tempo, length }: ColumnsProps) {
  return (
    <>
      <span className="track__song">
        <span className="track__cover">
          <Cover id={id} />
        </span>
        <span className="track__text">
          <span className="track__title">{title}</span>
          <span className="track__description">{description}</span>
        </span>
      </span>
      <span className="track__tempo">{tempo}</span>
      <span className="track__length">{length}</span>
    </>
  );
}
