// The main column: a playlist's title page (title, description, song count and length, its disc) with its play and shuffle
// buttons, then its songs.

import { formatLength, plural, textWidth } from '../format.ts';
import { playable, type LibraryPlaylist } from '../library.ts';
import { usePlayer, usePlayerState } from '../usePlayer.ts';
import { PlaylistCover } from './Cover.tsx';
import { IconButton } from './IconButton.tsx';
import { PauseIcon, PlayIcon, ShuffleIcon } from './Icons.tsx';
import { TrackRow } from './TrackRow.tsx';

export function PlaylistView({ playlist }: { playlist: LibraryPlaylist }) {
  const player = usePlayer();
  const current = usePlayerState((s) => s.playlist?.id === playlist.id);
  const playing = usePlayerState((s) => s.playlist?.id === playlist.id && s.status === 'playing');
  const shuffle = usePlayerState((s) => s.shuffle);
  const { title, description, songs, duration } = playlist;

  return (
    <main className="main">
      <header className="hero">
        <div className="hero__text">
          <p className="label">Playlist</p>
          <h1 className="hero__title" style={{ '--title-width': textWidth(title) }}>
            {title}
          </h1>
          <p className="hero__description">{description}</p>
          <p className="hero__meta label">
            <span>{plural(songs.length, 'song')}</span>
            <span>{formatLength(duration)}</span>
          </p>
          <div className="actions">
            <IconButton
              className="play-button play-button--large"
              label={playing ? 'Pause' : `Play ${title}`}
              disabled={!playable(playlist).length}
              onClick={() => (current ? player.toggle() : player.playAll(playlist))}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
            <IconButton className="toggle-button" label="Shuffle" pressed={shuffle} onClick={() => player.setShuffle(!shuffle)}>
              <ShuffleIcon />
            </IconButton>
          </div>
        </div>
        <div className="hero__disc">
          <PlaylistCover playlist={playlist} size="large" />
        </div>
      </header>

      <div className="tracks">
        <div className="tracks__head label" aria-hidden="true">
          <span className="track__index">No.</span>
          <span className="tracks__title">Title</span>
          <span className="track__tempo">Tempo</span>
          <span className="track__length">Length</span>
        </div>
        {songs.length ? (
          <ol aria-label={`Songs in ${title}`}>
            {songs.map((entry, i) => (
              <TrackRow key={entry.id} number={i + 1} playlist={playlist} entry={entry} />
            ))}
          </ol>
        ) : (
          <p className="tracks__empty">No songs here yet.</p>
        )}
      </div>
    </main>
  );
}
