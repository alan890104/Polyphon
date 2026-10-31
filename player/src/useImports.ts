// MIDI files imported in this session: converted in the browser, kept in memory (nothing is uploaded) and listed as one playlist.

import { useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from './format.ts';
import { importMidi, importsPlaylist, type LibraryPlaylist, type ReadySong } from './library.ts';
import { usePlayer } from './usePlayer.ts';

export interface Imports {
  /** "Your imports" (null until a file is imported) */
  playlist: LibraryPlaylist | null;
  /** Import files; resolves with whether any of them became a song */
  add: (files: File[]) => Promise<boolean>;
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

  return { playlist, add, errors, dismissErrors: () => setErrors([]) };
}
