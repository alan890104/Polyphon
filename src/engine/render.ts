// Offline rendering: play a song into a buffer as fast as the machine allows (for exporting audio files, tests and measurements).

import { songDuration, type Song } from '../song.ts';
import { createOutputStage } from './output.ts';
import { Playback } from './playback.ts';
import { prepareSongSync } from './prepare.ts';

export interface RenderOptions {
  /** Seconds to render (default: the intro, `loops` passes of the body, and 3 s for the tail to ring out) */
  duration?: number;
  /** How many passes of the body (default 1) */
  loops?: number;
  /** Default 44100 */
  sampleRate?: number;
}

/** Render a song to a stereo AudioBuffer, through the same output stage as live playback (browsers only: needs OfflineAudioContext) */
export async function renderSong(song: Song, { duration, loops = 1, sampleRate = 44100 }: RenderOptions = {}): Promise<AudioBuffer> {
  if (typeof OfflineAudioContext === 'undefined') throw new Error('renderSong needs OfflineAudioContext (a browser)');
  const { intro, loop } = songDuration(song);
  const length = duration ?? intro + loops * loop + 3;
  const ctx = new OfflineAudioContext(2, Math.ceil(length * sampleRate), sampleRate);
  prepareSongSync(ctx, song);
  const playback = new Playback(ctx, createOutputStage(ctx, ctx.destination), song, { at: 0.05, loops });
  playback.schedule(length);
  return ctx.startRendering();
}

/** Encode an AudioBuffer as a 16-bit PCM WAV file */
export function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytes = frames * channels * 2;
  const out = new DataView(new ArrayBuffer(44 + bytes));
  const text = (at: number, s: string) => [...s].forEach((c, i) => out.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  out.setUint32(4, 36 + bytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, channels, true);
  out.setUint32(24, buffer.sampleRate, true);
  out.setUint32(28, buffer.sampleRate * channels * 2, true);
  out.setUint16(32, channels * 2, true);
  out.setUint16(34, 16, true);
  text(36, 'data');
  out.setUint32(40, bytes, true);
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  for (let i = 0, at = 44; i < frames; i++) {
    for (let c = 0; c < channels; c++, at += 2) {
      const x = Math.max(-1, Math.min(1, data[c][i]));
      out.setInt16(at, x < 0 ? x * 0x8000 : x * 0x7fff, true);
    }
  }
  return out.buffer;
}
