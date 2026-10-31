// MP3 export: the encoding runs in a worker (see mp3.worker.ts), started for each file and closed when it is done.

import type { Mp3Job } from './mp3.worker.ts';

/** The sample rates an MP3 can have (Hz) */
export const MP3_RATES: readonly number[] = [32000, 44100, 48000];

/** Encode a rendered song as an MP3 file (default 192 kbps) */
export function encodeMp3(buffer: AudioBuffer, kbps = 192): Promise<Blob> {
  const worker = new Worker(new URL('./mp3.worker.ts', import.meta.url), { type: 'module' });
  return new Promise<Blob>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<Blob>) => resolve(e.data);
    worker.onerror = (e) => reject(new Error(e.message || 'MP3 encoding failed'));
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
    worker.postMessage({ channels, sampleRate: buffer.sampleRate, kbps } satisfies Mp3Job);
  }).finally(() => worker.terminate());
}
