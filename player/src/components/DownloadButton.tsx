// Download WAV: renders the song offline and hands the file to the browser. The button reads "Rendering…" meanwhile.

import type { Song } from 'polyphon';
import { useState } from 'react';
import { errorMessage } from '../format.ts';
import { usePlayer } from '../usePlayer.ts';
import { DownloadIcon } from './Icons.tsx';
import { Spinner } from './Indicators.tsx';

export function DownloadButton({ song }: { song: Song }) {
  const player = usePlayer();
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setRendering(true);
    setError(null);
    try {
      save(await player.exportWav(song), `${song.title}.wav`);
    } catch (e) {
      setError(errorMessage(e));
    }
    setRendering(false);
  };

  return (
    <button type="button" className="download-button" disabled={rendering} aria-busy={rendering} title={error ?? undefined} onClick={download}>
      {rendering ? <Spinner /> : <DownloadIcon />}
      {rendering ? 'Rendering…' : error ? 'Rendering failed. Try again' : 'Download WAV'}
    </button>
  );
}

/** Hand a file to the browser's downloads */
function save(file: Blob, name: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name.replace(/[\\/:*?"<>|]/g, '_');
  link.click();
  // Some browsers read the URL only after click() returns
  setTimeout(() => URL.revokeObjectURL(url));
}
