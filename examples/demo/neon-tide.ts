// Neon Tide: an original progressive-house track in F minor, 128 BPM.
// Intro and build (plays once): a filtered pad and pluck, then an accelerating snare roll, a riser and a reversed cymbal into the drop.
// Body: drop, piano breakdown with a short re-build, second drop with the lead doubled an octave up.
// There is no sidechain compressor: the chords and the bass sit on the off-beats, so the kick has the downbeats to itself and the mix pumps.

import { arpeggio, bassline, chords, defineSong, melody, pad, rest, rhythm, scaleVelocity, sequence, slice, strum, transpose, repeat } from 'polyphon';

const LOOP = 'Fm | Db | Ab | Eb';
const prog8 = chords(`${LOOP} | ${LOOP}`);
const prog16 = chords(`${LOOP} | ${LOOP} | ${LOOP} | ${LOOP}`);

/** The hook, 8 bars */
const hook = melody(`
  C5:2 C5:1 Ab4:1 r:1 C5:2 Eb5:2 F5:3 Eb5:2 C5:2 | Db5:2 Db5:1 C5:1 r:1 Ab4:2 Bb4:2 C5:3 Ab4:4 |
  Eb5:2 Eb5:1 C5:1 r:1 Eb5:2 F5:2 Ab5:3 G5:2 Eb5:2 | G5:3 F5:3 Eb5:2 Bb4:8 |
  C5:2 C5:1 Ab4:1 r:1 C5:2 Eb5:2 F5:3 Eb5:2 C5:2 | Db5:2 Db5:1 C5:1 r:1 Ab4:2 Bb4:2 C5:3 Ab4:4 |
  Eb5:2 Eb5:1 C5:1 r:1 Eb5:2 F5:2 Ab5:3 G5:2 Eb5:2 | G5:3 Ab5:3 Bb5:2 G5:4 Eb5:4 |
`);
const drop = repeat(hook, 2);

/** n bars of one drum bar */
const bars = (bar: string, n: number) => rhythm(bar.repeat(n));
/** A snare roll that doubles its speed: quarters, eighths, sixteenths, thirty-seconds */
const roll = (quarterBars: number) =>
  sequence(
    scaleVelocity(bars('x...', quarterBars * 4), 0.5),
    scaleVelocity(bars('x.', (quarterBars / 2) * 8), 0.65),
    scaleVelocity(bars('x', 16 * (quarterBars / 4)), 0.8),
    scaleVelocity(rhythm('x'.repeat(32 * (quarterBars / 4)), { step: 0.5 }), 1),
  );
/** A reversed cymbal (1.6 s, about 14 steps at 128 BPM) whose peak lands at the end of `steps` */
const swellInto = (steps: number) => melody(`r:${steps - 14} C4:14`);

const pumpChords = (p: typeof prog16) => strum(p, '..x-..x-..x-..x-', { center: 'Ab4', size: 4, spread: 0 });
const pumpBass = (p: typeof prog16) => bassline(p, '..x...x...x...x.', '1 1 8 1', { register: 'F2' });
const pumpSub = (p: typeof prog16) => bassline(p, '..x-..x-..x-..x-', '1', { register: 'F1' });

export default defineSong({
  title: 'Neon Tide',
  description: 'An original progressive-house track in F minor, 128 BPM: build, drop, piano breakdown, second drop.',
  bpm: 128,
  reverb: { size: 1.6, damp: 0.4 },
  delay: { steps: 3, feedback: 0.35, tone: 3500, mix: 0.6 },
  intro: [
    { name: 'Pad', instrument: 'warmPad', part: sequence(pad(prog8, { center: 'Ab4', velocity: 0.6 }), pad(prog8, { center: 'Ab4', velocity: 0.75 })), gain: 0.7, reverb: 0.5, params: { attack: 1.2, release: 1.5, cut: 1400 } },
    { name: 'Pluck', instrument: 'synthLead', part: arpeggio(prog16, '0 1 2 3 2 1 2 3', { center: 'C5', velocity: 0.55 }), gain: 0.5, pan: -0.2, reverb: 0.3, delay: 0.3, params: { cut: 2600, vib: 0, release: 0.05 } },
    { name: 'Lead (filtered)', instrument: 'synthLead', part: sequence(rest(8), hook), gain: 0.6, reverb: 0.3, delay: 0.2, params: { cut: 1300, vib: 0 } },
    { name: 'Kick', instrument: 'kick', part: sequence(rest(4), bars('X...', 40), rest(2)) },
    { name: 'Hi-hat', instrument: 'hat', part: sequence(rest(4), bars('..x...x...x...x.', 12)), gain: 0.5, pan: 0.2 },
    { name: 'Snare roll', instrument: 'snare', part: sequence(rest(8), roll(4)), gain: 0.7, reverb: 0.25 },
    { name: 'Riser', instrument: 'riser', part: sequence(rest(8), melody('C4:128')), gain: 0.7, reverb: 0.4 },
    { name: 'Reverse cymbal', instrument: 'swell', part: swellInto(256), gain: 0.8, repeat: false },
  ],
  tracks: [
    // Leads
    { name: 'Lead', instrument: 'synthLead', part: sequence(drop, rest(8), drop), gain: 0.9, reverb: 0.25, delay: 0.18, params: { cut: 5200, vib: 0, release: 0.08 } },
    { name: 'Lead octave', instrument: 'synthLead', part: sequence(rest(24), transpose(drop, 12)), gain: 0.35, pan: 0.15, reverb: 0.3, delay: 0.2, params: { cut: 6000, vib: 0 } },
    { name: 'Piano', instrument: 'piano', part: sequence(rest(16), slice(hook, 0, 64), rest(4), rest(16)), gain: 0.9, reverb: 0.45, delay: 0.15 },
    // Harmony
    { name: 'Chord stabs', instrument: 'warmPad', part: sequence(pumpChords(prog16), rest(8), pumpChords(prog16)), gain: 0.75, reverb: 0.2, params: { attack: 0.005, release: 0.15, cut: 4500 } },
    { name: 'Breakdown pad', instrument: 'airPad', part: sequence(rest(16), pad(prog8, { center: 'Ab4', velocity: 0.6 }), rest(16)), gain: 0.6, reverb: 0.6 },
    { name: 'Bass', instrument: 'synthBass', part: sequence(pumpBass(prog16), rest(8), pumpBass(prog16)), gain: 0.8 },
    { name: 'Sub', instrument: 'sub', part: sequence(pumpSub(prog16), rest(8), pumpSub(prog16)), gain: 0.7 },
    // Drums
    { name: 'Kick', instrument: 'kick', part: sequence(bars('X...', 64), rest(4), bars('X...', 16), bars('X...', 64)), gain: 1 },
    { name: 'Clap', instrument: 'clap', part: sequence(bars('....X.......X...', 16), rest(8), bars('....X.......X...', 16)), gain: 0.8, reverb: 0.25 },
    { name: 'Open hat', instrument: 'ohat', part: sequence(bars('..x...x...x...x.', 16), rest(8), bars('..x...x...x...x.', 16)), gain: 0.5, pan: 0.15 },
    { name: 'Hi-hat', instrument: 'hat', part: sequence(bars('xoxoxoxoxoxoxoxo', 16), rest(8), bars('xoxoxoxoxoxoxoxo', 16)), gain: 0.3, pan: -0.15 },
    { name: 'Snare roll', instrument: 'snare', part: sequence(rest(20), roll(2), rest(16)), gain: 0.7, reverb: 0.25 },
    { name: 'Riser', instrument: 'riser', part: sequence(rest(20), melody('C4:64'), rest(16)), gain: 0.7, reverb: 0.4 },
    { name: 'Reverse cymbal', instrument: 'swell', part: swellInto(384), gain: 0.8, repeat: false },
    { name: 'Crash', instrument: 'crash', part: sequence(rhythm('X'.padEnd(384, '.')), rhythm('X'.padEnd(256, '.'))), gain: 0.8, reverb: 0.3 },
  ],
});
