// Neon Tide: an original progressive-house track in F minor, 128 BPM, arranged like a big-room festival record.
//
// Intro, plays once (24 bars)
//   1-8    kick, off-beat hats, a pluck arpeggio and a dark pad, slowly opening up
//   9-16   the clap, the 909 hats and the off-beat bass come in
//   17-24  build: the hook on a supersaw over held chords, both opening up; a riser; a snare roll that doubles its speed every two bars.
//          The kick loses its low end and drops out halfway, the bass and the pad thin out, and the last beat is a breath
// Body, loops (57 bars)
//   1-16   drop: a kick tuned to F, clap and snare on 2 and 4, 909 hats, pumping supersaw chords, sub and off-beat bass, and the hook
//          on a supersaw over a Minimoog-style lead an octave down
//   17-32  breakdown: a downlifter, then a pad and the piano (broken chords, then the hook), a pluck creeping in under it
//   33-40  second build, like the first
//   41-56  final drop: the hook doubled an octave up, a sixteenth-note pluck, a rolling bass and a shaker on top
//   57     the last hit, ringing out
// Mix: everything but the drums and the piano ducks under "Pump", a silent four-on-the-floor, so the music keeps pumping where the
// kick drops out. Kick, sub and bass stay dry, mono and centred; the master is glued and limited loud.

import { arpeggio, bassline, chords, defineSong, melody, pad, pedal, rest, rhythm, roots, scaleVelocity, sequence, slice, stack, transpose, type Chord, type Part, type Sweep } from 'polyphon';

/** Lay a track out over sections of these lengths (bars): each part is padded with rest to the end of its section; null is a silent section */
const sections = (...lengths: number[]) => (...parts: (Part | null)[]): Part =>
  sequence(...lengths.map((bars, i) => sequence(parts[i] ?? rest(0), rest(bars - (parts[i]?.duration ?? 0) / 16))));
/** The intro's sections: bars 1-8, bars 9-16, the build */
const intro = sections(8, 8, 8);
/** The body's sections: drop, breakdown, build, final drop, last hit */
const body = sections(16, 16, 8, 16, 1);

const LOOP = 'Fm | Db | Ab | Eb';
/** The progression over n bars (a multiple of 4) */
const prog = (n: number) => chords(Array(n / 4).fill(LOOP).join(' | '));

/** The hook, 8 bars */
const hook = melody(`
  C5:2 C5:1 Ab4:1 r:1 C5:2 Eb5:2 !F5:3 Eb5:2 C5:2 | Db5:2 Db5:1 C5:1 r:1 Ab4:2 Bb4:2 !C5:3 Ab4:4 |
  Eb5:2 Eb5:1 C5:1 r:1 Eb5:2 F5:2 !Ab5:3 G5:2 Eb5:2 | !G5:3 F5:3 Eb5:2 Bb4:8 |
  C5:2 C5:1 Ab4:1 r:1 C5:2 Eb5:2 !F5:3 Eb5:2 C5:2 | Db5:2 Db5:1 C5:1 r:1 Ab4:2 Bb4:2 !C5:3 Ab4:4 |
  Eb5:2 Eb5:1 C5:1 r:1 Eb5:2 F5:2 !Ab5:3 G5:2 Eb5:2 | !G5:3 Ab5:3 Bb5:2 !G5:4 Eb5:4 |
`);
const drop = sequence(hook, hook);
/** The last hit: a quarter note, then the bar rings out */
const last = (notes: string) => melody(`${notes}:4 r:12`);
/** The part with its last beat silent: the breath before a drop */
const breath = (p: Part): Part => sequence(slice(p, 0, p.duration - 4), 'r:4');

// ── Drums
const FOUR = 'X...X...X...X...';
const OFFBEAT = '..x...x...x...x.';
/** Closed hats on the beat, a ghost after it and a push before the next; the open hat sits on the off-beat and the push cuts it off */
const HATS = 'xo.oxo.oxo.oxo.o';
const OPEN = '..X...X...X...X.';
const SHAKER = 'oxXxoxXxoxXxoxXx';
/** One hit (its section pads it out) */
const HIT = rhythm('X');

/** n bars of a one-bar pattern */
const bars = (pattern: string, n: number) => rhythm(pattern.repeat(n));
/** Four on the floor, the kick tuned to the key */
const kicks = (n: number) => rhythm(FOUR.repeat(n), { pitch: 'F1' });
/** 2 and 4, with a pickup at the end of every eighth bar */
const backbeat = (n: number) => rhythm(Array.from({ length: n }, (_, i) => (i % 8 === 7 ? '....X.......XoxX' : '....X.......X...')).join(''));
/** A hit on the first beat of every eighth bar */
const crashes = (n: number) => rhythm('X'.padEnd(128, '.').repeat(n / 8));

/** Velocities rising from `from` to `to` times their own through a part */
const crescendo = (p: Part, from: number, to: number): Part => ({ ...p, notes: p.notes.map((n) => ({ ...n, velocity: n.velocity * (from + ((to - from) * n.time) / p.duration) })) });
/** The 8-bar snare roll of a build: two bars each of quarters, eighths, sixteenths and thirty-seconds, swelling from soft to full */
const roll = crescendo(sequence(bars('X...', 8), bars('X.', 16), bars('X', 32), rhythm('X'.repeat(64), { step: 0.5 })), 0.3, 1);
/** A reversed cymbal (1.6 s, 13.65 steps at 128 BPM) whose peak lands n bars in */
const swellInto = (n: number) => melody(`r:${n * 16 - 13.65} C4:13.65`);

// ── Harmony
/** Wide chords for the supersaw: an open fifth in the bass under a close triad around Ab4 */
const wide = (p: Chord[]) => stack(roots(p, { register: 'F3', fifth: true, velocity: 0.78 }), pad(p, { center: 'Ab4', size: 3 }));
/** Off-beat bass, the house bounce against the kick */
const offbeat = (p: Chord[]) => bassline(p, OFFBEAT, '1', { register: 'Ab2' });
/** Rolling bass for the final drop: three sixteenths after every kick, the last an octave up */
const rolling = (p: Chord[]) => bassline(p, '.xxx.xxx.xxx.xxx', '1 1 8', { register: 'Ab2' });
/** The sub: one sine per chord, F1 to Eb2 */
const sub = (p: Chord[]) => roots(p, { register: 'Ab1' });
/** Trance arpeggio in sixteenths, climbing through two octaves */
const arp = (p: Chord[]) => arpeggio(p, '0 2 1 3 2 4 3 5', { step: 1, center: 'C5', size: 3, accent: 4 });
/** The piano of the breakdown: broken chords, then the hook, over open fifths, the pedal changing with the chords */
const breakdownPiano = pedal(
  stack(sequence(arpeggio(prog(8), '0 1 2 3 4 3 2 1', { center: 'Ab4', velocity: 0.7 }), hook), roots(prog(16), { register: 'F2', fifth: true, velocity: 0.5 })),
  prog(16),
);

// ── Mix
/** A filter sweep as [bar, Hz] points, bars counted from 1 at the start of the section (24.75 is the last beat of bar 24) */
const sweep = (...points: [number, number][]): Sweep => Object.fromEntries(points.map(([bar, hz]) => [(bar - 1) * 16, hz]));
/** Duck under the silent four-on-the-floor this deep */
const pump = (depth: number) => ({ by: 'Pump', depth });
const LEAD = { detune: 0.45, mix: 0.65, cut: 9000, release: 0.2 };
const CHORDS = { detune: 0.6, mix: 0.8, cut: 6000, attack: 0.005, release: 0.3 };

export default defineSong({
  title: 'Neon Tide',
  description: 'An original progressive-house track in F minor, 128 BPM: a filtered intro and build, a supersaw drop pumping under a tuned kick, a piano breakdown, a second build and a bigger final drop.',
  bpm: 128,
  reverb: { size: 1.8, damp: 0.45 },
  delay: { steps: 3, feedback: 0.35, tone: 3500, mix: 0.6 },
  master: { glue: 0.5, loud: 6 },
  intro: [
    // Drums: in the build the kick loses its low end, then drops out
    { name: 'Kick', instrument: 'bigKick', part: intro(kicks(8), kicks(8), kicks(4)), gain: 0.75, reverb: 0, highpass: sweep([17, 20], [20.75, 300]) },
    { name: 'Pump', instrument: 'bigKick', part: bars(FOUR, 24), gain: 0 },
    { name: 'Clap', instrument: 'clap909', part: intro(null, backbeat(8)), gain: 0.65, reverb: 0.2 },
    { name: 'Hi-hat', instrument: 'hat909', part: intro(bars(OFFBEAT, 8), bars(HATS, 8)), gain: 0.55, pan: -0.15 },
    { name: 'Open hat', instrument: 'ohat909', part: intro(null, bars(OPEN, 8)), gain: 0.5, pan: 0.15 },
    { name: 'Snare roll', instrument: 'snare909', part: intro(null, null, breath(roll)), gain: 0.35, reverb: 0.3 },
    { name: 'Crash', instrument: 'crash', part: intro(null, HIT, HIT), gain: 0.5, reverb: 0.3 },
    // Effects
    { name: 'Riser', instrument: 'riser', part: intro(null, null, melody('F4:128')), gain: 0.4, reverb: 0.3, highpass: 150 },
    { name: 'Reverse cymbal', instrument: 'swell', part: intro(null, null, swellInto(8)), gain: 0.8 },
    // Music: the pad and the pluck open up; in the build the hook and the chords open up while the bass and the pad thin out
    { name: 'Pad', instrument: 'darkPad', part: breath(pad(prog(24), { center: 'Ab4' })), gain: 0.6, reverb: 0.5, params: { attack: 1.5, release: 1.5 }, duck: pump(0.5), lowpass: sweep([1, 500], [17, 2500]), highpass: sweep([17, 30], [24.75, 900]) },
    { name: 'Pluck', instrument: 'pluck', part: breath(arpeggio(prog(24), '0 1 2 3 2 1 2 3', { center: 'C5' })), gain: 0.5, pan: -0.2, reverb: 0.3, delay: 0.3, duck: pump(0.5), lowpass: sweep([1, 800], [17, 3000], [24.75, 9000]) },
    { name: 'Bass', instrument: 'synthBass', part: intro(null, offbeat(prog(8)), breath(offbeat(prog(8)))), gain: 0.8, reverb: 0, duck: pump(0.6), highpass: sweep([17, 20], [21, 60], [24.75, 500]) },
    { name: 'Chords', instrument: 'supersaw', part: intro(null, null, breath(wide(prog(8)))), gain: 0.7, reverb: 0.25, params: CHORDS, duck: pump(0.75), lowpass: sweep([17, 300], [24.75, 9000]) },
    { name: 'Lead', instrument: 'supersaw', part: intro(null, null, breath(hook)), gain: 0.75, reverb: 0.3, delay: 0.2, params: LEAD, duck: pump(0.3), lowpass: sweep([17, 500], [24.75, 9000]) },
  ],
  tracks: [
    // Drums: in the build the kick loses its low end, then drops out
    { name: 'Kick', instrument: 'bigKick', part: body(kicks(16), null, kicks(4), kicks(16), rhythm('X', { pitch: 'F1' })), gain: 0.75, reverb: 0, highpass: sweep([33, 20], [36.75, 300], [41, 20]) },
    { name: 'Pump', instrument: 'bigKick', part: body(bars(FOUR, 16), null, bars(FOUR, 8), bars(FOUR, 16)), gain: 0 },
    { name: 'Clap', instrument: 'clap909', part: body(backbeat(16), null, null, backbeat(16)), gain: 0.65, reverb: 0.2 },
    { name: 'Snare', instrument: 'snare909', part: body(backbeat(16), null, null, backbeat(16)), gain: 0.3, reverb: 0.2 },
    { name: 'Hi-hat', instrument: 'hat909', part: body(bars(HATS, 16), sequence(rest(8), scaleVelocity(bars(OFFBEAT, 8), 0.8)), null, bars(HATS, 16)), gain: 0.4, pan: -0.15 },
    { name: 'Open hat', instrument: 'ohat909', part: body(bars(OPEN, 16), null, null, bars(OPEN, 16)), gain: 0.45, pan: 0.15 },
    { name: 'Shaker', instrument: 'shaker', part: body(null, null, null, bars(SHAKER, 16)), gain: 0.5, pan: 0.3 },
    { name: 'Snare roll', instrument: 'snare909', part: body(null, null, breath(roll)), gain: 0.35, reverb: 0.3 },
    { name: 'Crash', instrument: 'crash', part: body(crashes(16), null, null, crashes(16), HIT), gain: 0.5, reverb: 0.3 },
    // Effects
    { name: 'Impact', instrument: 'impact', part: body(HIT, null, null, HIT, HIT), gain: 0.7, reverb: 0.1 },
    { name: 'Downlifter', instrument: 'downlifter', part: body(null, melody('C4:32')), gain: 0.5, reverb: 0.4 },
    { name: 'Riser', instrument: 'riser', part: body(null, null, melody('F4:128')), gain: 0.4, reverb: 0.3, highpass: 150 },
    { name: 'Reverse cymbal', instrument: 'swell', part: body(swellInto(8), null, swellInto(8), swellInto(8)), gain: 0.8 },
    // Bass
    { name: 'Sub', instrument: 'sub', part: body(sub(prog(16)), null, null, sub(prog(16)), last('F1')), gain: 1.2, reverb: 0, duck: pump(0.9) },
    { name: 'Bass', instrument: 'synthBass', part: body(offbeat(prog(16)), null, breath(offbeat(prog(8))), rolling(prog(16))), gain: 0.8, reverb: 0, duck: pump(0.6), highpass: sweep([33, 20], [37, 60], [40.75, 500], [41, 20]) },
    // Harmony
    { name: 'Chords', instrument: 'supersaw', part: body(wide(prog(16)), null, breath(scaleVelocity(wide(prog(8)), 0.8)), wide(prog(16)), last('F3+C4+F4+Ab4+C5')), gain: 0.85, reverb: 0.2, params: CHORDS, duck: pump(0.8), lowpass: sweep([17, 16000], [33, 300], [40.75, 9000], [41, 16000]) },
    { name: 'Pad', instrument: 'warmPad', part: body(null, pad(prog(16), { center: 'Ab4' })), gain: 0.3, reverb: 0.5, params: { attack: 1.5, release: 2 }, lowpass: sweep([17, 1500], [33, 6000]) },
    { name: 'Piano', instrument: 'piano', part: body(null, breakdownPiano), gain: 0.4, reverb: 0.45, delay: 0.15 },
    { name: 'Pluck', instrument: 'pluck', part: body(null, sequence(rest(8), arp(prog(8))), breath(arp(prog(8))), arp(prog(16))), gain: 0.4, pan: 0.2, reverb: 0.3, delay: 0.25, duck: pump(0.5), lowpass: sweep([25, 800], [33, 3000], [40.75, 9000], [41, 12000]) },
    // Leads: the hook on a supersaw over a Minimoog-style lead an octave down, doubled an octave up in the final drop
    { name: 'Lead', instrument: 'supersaw', part: body(drop, null, breath(scaleVelocity(hook, 0.8)), drop, last('F5')), gain: 1.05, reverb: 0.3, delay: 0.2, params: LEAD, duck: pump(0.4), lowpass: sweep([32, 14000], [33, 500], [40.75, 9000], [41, 14000]) },
    { name: 'Lead body', instrument: 'synthLead', part: body(transpose(drop, -12), null, null, transpose(drop, -12), last('F4')), gain: 0.55, reverb: 0.2, delay: 0.1, params: { cut: 2200, vib: 0, release: 0.1 }, duck: pump(0.4), highpass: 180 },
    { name: 'Lead high', instrument: 'supersaw', part: body(null, null, null, transpose(drop, 12)), gain: 0.5, reverb: 0.35, delay: 0.25, params: LEAD, duck: pump(0.4) },
  ],
});
