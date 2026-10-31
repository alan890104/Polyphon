// Encodes a rendered song as an MP3 off the main thread, so the page and the music playing keep going. The encoder is lamejs
// (LGPL-3.0, a JavaScript port of LAME, lame.sourceforge.net), loaded unmodified and only here, in its own file.

import { Mp3Encoder } from '@breezystack/lamejs';

export interface Mp3Job {
  /** One array per channel, -1 to 1 */
  channels: Float32Array[];
  /** 32000, 44100 or 48000 */
  sampleRate: number;
  kbps: number;
}

/** Samples handed to the encoder at a time: a whole number of MP3 frames (1152 samples each) */
const BLOCK = 1152 * 32;

self.onmessage = ({ data: { channels, sampleRate, kbps } }: MessageEvent<Mp3Job>) => {
  const encoder = new Mp3Encoder(channels.length, sampleRate, kbps);
  const pcm = channels.map(() => new Int16Array(BLOCK));
  const parts: Uint8Array[] = [];
  for (let at = 0; at < channels[0].length; at += BLOCK) {
    const n = Math.min(BLOCK, channels[0].length - at);
    channels.forEach((samples, c) => {
      for (let i = 0; i < n; i++) {
        const x = Math.max(-1, Math.min(1, samples[at + i]));
        pcm[c][i] = x < 0 ? x * 0x8000 : x * 0x7fff;
      }
    });
    const [left, right] = pcm.map((p) => p.subarray(0, n));
    parts.push(encoder.encodeBuffer(left, right));
  }
  parts.push(encoder.flush());
  // lamejs hands back fresh copies, each on its own ArrayBuffer
  self.postMessage(new Blob(parts as Uint8Array<ArrayBuffer>[], { type: 'audio/mpeg' }));
};
