// Downloads: renders the song offline and hands the file to the browser, as an MP3 (small, plays everywhere) or a lossless WAV
// (about seven times larger, for editing). The button being made reads "Rendering…" meanwhile.

import type { Song } from 'polyphon';
import { useState } from 'react';
import { errorMessage } from '../format.ts';
import { usePlayer } from '../usePlayer.ts';
import { DownloadIcon } from './Icons.tsx';
import { Spinner } from './Indicators.tsx';

type Format = 'mp3' | 'wav';

export function Downloads({ song }: { song: Song }) {
  const player = usePlayer();
  const [rendering, setRendering] = useState<Format | null>(null);
  const [failed, setFailed] = useState<{ format: Format; message: string } | null>(null);

  const download = async (format: Format) => {
    setRendering(format);
    setFailed(null);
    try {
      save(await player.exportAudio(song, format), `${song.title}.${format}`);
    } catch (e) {
      setFailed({ format, message: errorMessage(e) });
    }
    setRendering(null);
  };

  const button = (format: Format, label: string, title: string) => (
    <button
      type="button"
      className={`download-button download-button--${format}`}
      disabled={rendering !== null}
      aria-busy={rendering === format}
      title={failed?.format === format ? failed.message : title}
      onClick={() => download(format)}
    >
      {rendering === format ? <Spinner /> : format === 'mp3' && <DownloadIcon />}
      {rendering === format ? 'Rendering…' : failed?.format === format ? 'Failed. Try again' : label}
    </button>
  );

  return (
    <div className="downloads">
      {button('mp3', 'Download MP3', 'MP3, 192 kbps')}
      {button('wav', 'WAV', 'Lossless WAV, about seven times larger')}
    </div>
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
