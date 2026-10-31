// The listener's own songs, from this session: MIDI files they imported (converted in the browser) and tunes they hummed, kept in
// memory (nothing is uploaded) and listed as one playlist.

import type { Song } from 'polyphon';
import { useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from './format.ts';
import { importMidi, importsPlaylist, readySong, type LibraryPlaylist, type ReadySong } from './library.ts';
import { usePlayer } from './usePlayer.ts';

export interface Imports {
  /** "Your songs" (null until there is one) */
  playlist: LibraryPlaylist | null;
  /** Import files; resolves with whether any of them became a song */
  add: (files: File[]) => Promise<boolean>;
  /** Add a song made in the player (a hummed tune) */
  addSong: (song: Song) => void;
  /** How many tunes have been hummed, for naming the next */
  hummed: number;
  /** Why files of the last import failed, one line per file */
  errors: string[];
  dismissErrors: () => void;
}

export function useImports(): Imports {
  const player = usePlayer();
  const [songs, setSongs] = useState<ReadySong[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const imported = useRef(0);
  const playlist = useMemo(() => (songs.length ? importsPlaylist(songs) : null), [songs]);

  // Songs imported while this playlist plays join its playback order
  useEffect(() => {
    if (playlist) player.updatePlaylist(playlist);
  }, [player, playlist]);

  const add = async (files: File[]) => {
    const results = await Promise.allSettled(files.map((file) => importMidi(file, `import-${++imported.current}-${file.name}`)));
    const added = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    if (added.length) setSongs((list) => [...list, ...added]);
    setErrors(results.flatMap((r, i) => (r.status === 'rejected' ? [`${files[i].name}: ${errorMessage(r.reason)}`] : [])));
    return added.length > 0;
  };

  const [hummed, setHummed] = useState(0);
  const addSong = (song: Song) => {
    setSongs((list) => [...list, readySong(`tune-${++imported.current}`, song)]);
    setHummed((n) => n + 1);
  };

  return { playlist, add, addSong, hummed, errors, dismissErrors: () => setErrors([]) };
}
