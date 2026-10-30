// The song position the visuals draw at: read from the playback's audio clock every frame (at the moment being heard, output
// latency included), or carried forward from the last reported position when there is no playback to read.

import type { Playback } from 'polyphon';

export interface ClockSource {
  /** Seconds into the song, as last reported */
  position: number;
  playing: boolean;
  /** The live playback, when there is one: read directly, it is exact to the sample */
  playback?: Playback | null;
}

export class SongClock {
  private source: ClockSource = { position: 0, playing: false };
  private reportedAt = performance.now();

  set(source: ClockSource): void {
    this.source = source;
    this.reportedAt = performance.now();
  }

  get playing(): boolean {
    return this.source.playing;
  }

  /** Seconds into the song, now */
  now(): number {
    const { playback, position, playing } = this.source;
    if (!playing) return position;
    if (playback?.playing) return playback.position(heardTime(playback.context)).seconds;
    return position + (performance.now() - this.reportedAt) / 1000;
  }
}

/** The context time of the sound reaching the listener now (currentTime runs ahead of the speakers by the output latency) */
function heardTime(context: BaseAudioContext): number {
  if (!(context instanceof AudioContext)) return context.currentTime;
  const { contextTime, performanceTime } = context.getOutputTimestamp();
  if (!contextTime || !performanceTime) return context.currentTime - (context.outputLatency || context.baseLatency || 0);
  return Math.min(context.currentTime, contextTime + (performance.now() - performanceTime) / 1000);
}
