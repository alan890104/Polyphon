// Render every sample a song needs before it plays, so playback never has to compute audio.

import { prepareSamples, prepareSamplesSync } from '../instruments/samples.ts';
import type { Song } from '../song.ts';
import { sampleRequests } from './compile.ts';

/** Render a song's samples in the background (yields to the main thread every 12 ms) */
export function prepareSong(context: BaseAudioContext, song: Song): Promise<void> {
  return prepareSamples(context, sampleRequests(song));
}

/** Render a song's samples right now (for short jingles and offline rendering) */
export function prepareSongSync(context: BaseAudioContext, song: Song): void {
  prepareSamplesSync(context, sampleRequests(song));
}
