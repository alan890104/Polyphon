// The final stage every song goes through, live or rendered: the level songs are balanced for, then a gentle limiter.

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
