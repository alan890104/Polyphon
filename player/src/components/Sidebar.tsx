// The library column: the app's name and tagline, the MIDI import button, then the playlists (a horizontal strip on phones).

import { useEffect, useRef } from 'react';
import { plural } from '../format.ts';
import type { LibraryPlaylist } from '../library.ts';
import { usePlayerState } from '../usePlayer.ts';
import { PlaylistCover } from './Cover.tsx';
import { Logo } from './Icons.tsx';
import { ImportButton } from './ImportButton.tsx';
import { PlayingDisc } from './Indicators.tsx';

interface SidebarProps {
  playlists: LibraryPlaylist[];
  selected: LibraryPlaylist;
  onSelect: (playlist: LibraryPlaylist) => void;
  onImport: (files: File[]) => void;
}

export function Sidebar({ playlists, selected, onSelect, onImport }: SidebarProps) {
  const playingFrom = usePlayerState((s) => (s.status === 'playing' ? s.playlist?.id : null));
  const list = useRef<HTMLUListElement>(null);

  // Keep the open playlist in view (on phones the strip can start with it off-screen)
  useEffect(() => {
    list.current?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected.id]);

  return (
    <nav className="sidebar" aria-label="Playlists">
      <p className="brand">
        <Logo />
        <span className="brand__name">Polyphon</span>
      </p>
      <p className="tagline">Music written as code. Every note synthesized in your browser.</p>
      <h2 className="sidebar__heading label">Playlists</h2>
      <ImportButton onImport={onImport} />
      <ul ref={list} className="sidebar__list">
        {playlists.map((playlist) => (
          <li key={playlist.id}>
            <button
              type="button"
              className="playlist-link"
              aria-current={playlist === selected ? 'page' : undefined}
              onClick={() => onSelect(playlist)}
            >
              <span className="playlist-link__disc">
                <PlaylistCover playlist={playlist} />
              </span>
              <span className="playlist-link__title">{playlist.title}</span>
              {playlist.id === playingFrom ? (
                <PlayingDisc />
              ) : (
                <span className="playlist-link__count" aria-label={plural(playlist.songs.length, 'song')}>
                  {playlist.songs.length}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
