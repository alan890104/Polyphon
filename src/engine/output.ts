// The final stage every song goes through, live or rendered: the level songs are balanced for, then a gentle limiter.
// A song mastered loud (`master.loud`) ends in a stage of its own instead, a brickwall limiter, and goes around this one.

import type { Song } from '../song.ts';

/** Songs are mixed to sound right at this bus level */
export const MIX_LEVEL = 0.36;

/** Level and limiter in front of a destination; returns the stage's input */
export function createOutputStage(ctx: BaseAudioContext, destination: AudioNode): GainNode {
  const level = ctx.createGain();
  level.gain.value = MIX_LEVEL;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.ratio.value = 4;
  level.connect(limiter).connect(destination);
  return level;
}

/** Songs mastered loud end in a limiter of their own, so they skip the output stage */
export function mastersItself(song: Song): boolean {
  return song.master?.loud !== undefined;
}

/** The loudest a song mastered loud peaks, dBFS (its inter-sample peaks stay under -0.5) */
const CEILING = -1;

/**
 * The final stage of a song mastered loud: `loud` dB of drive into a brickwall limiter (songs peak around full scale before the
 * bus level, so that is about how much their loudest moments are turned down), then a soft clipper that rounds off whatever gets
 * past it, under the ceiling. Returns its input.
 */
export function createLoudStage(ctx: BaseAudioContext, loud: number, destination: AudioNode): GainNode {
  const drive = ctx.createGain();
  drive.gain.value = dB(loud);
  const limiter = new DynamicsCompressorNode(ctx, { threshold: CEILING, knee: 0, ratio: 20, attack: 0.001, release: 0.06 });
  // Take back the makeup gain Web Audio adds, (1 / the gain at 0 dBFS) ^ 0.6; and halve the signal, since a WaveShaper reads
  // inputs from -1 to 1 and the clipper's curve covers peaks up to 6 dB over full scale
  const trim = ctx.createGain();
  trim.gain.value = dB(0.6 * CEILING * (1 - 1 / 20)) / 2;
  const clipper = ctx.createWaveShaper();
  clipper.curve = softClip(dB(CEILING - 2), dB(CEILING));
  clipper.oversample = '4x';
  drive.connect(limiter).connect(trim).connect(clipper).connect(destination);
  return drive;
}

/** WaveShaper curve over inputs -2 to 2: straight up to `knee`, then bending smoothly over towards `ceiling` */
function softClip(knee: number, ceiling: number): Float32Array<ArrayBuffer> {
  const room = ceiling - knee;
  return Float32Array.from({ length: 4097 }, (_, i) => {
    const x = (i / 2048 - 1) * 2;
    const a = Math.abs(x);
    return a <= knee ? x : Math.sign(x) * (knee + room * Math.tanh((a - knee) / room));
  });
}

/** Decibels to a gain */
const dB = (db: number): number => Math.pow(10, db / 20);
