// Covers: each song's own disc, its notes punched as perforations; a playlist's disc holds all of its songs end to end.

import { discImage, EMPTY_DISC, playlistDisc, songDisc, type DiscSize } from '../disc.ts';
import type { LibraryPlaylist, LibrarySong } from '../library.ts';

export function Cover({ entry, size = 'small' }: { entry: LibrarySong; size?: DiscSize }) {
  const disc = entry.status === 'ready' ? songDisc(entry.song) : EMPTY_DISC;
  return <img className="cover" src={discImage(disc, size)} alt="" draggable={false} />;
}

export function PlaylistCover({ playlist, size = 'small' }: { playlist: LibraryPlaylist; size?: DiscSize }) {
  return <img className="cover" src={discImage(playlistDisc(playlist), size)} alt="" draggable={false} />;
}
