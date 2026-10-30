// The built-in orchestra. Sampled instruments are rendered offline (dsp/, bowed.ts) and cached per pitch;
// live instruments (voices.ts) are synthesized note by note. Tracks pick instruments by name.

import type { InstrumentDef, LiveInstrument, Render, SampledInstrument } from './definition.ts';
import { midiToFrequency as f0 } from './definition.ts';
import { AMB } from './dsp/ambience.ts';
import { DRUMS } from './dsp/drums.ts';
import { modal, type ModalPartial } from './dsp/modal.ts';
import { epiano, piano } from './dsp/piano.ts';
import { DULCIMER_BODY, GUITAR_BODY, HARP_BODY, ks, LUTE_BODY, pluckAdd, STEEL_BODY, VIOLIN_BODY } from './dsp/pluck.ts';
import { brassStab, spicc } from './dsp/staccato.ts';
import { BOWS, bowSample } from './bowed.ts';
import { VOICES } from './voices.ts';

/** The factor by which decay gets faster as pitch rises */
const hiShort = (m: number, ref = 60, per = 24) => Math.pow(0.5, (m - ref) / per);

function modalInst(parts: ModalPartial[], len: number, extra: Omit<Parameters<typeof modal>[3], 'len'> = {}, tscale = true): Render {
  return (sr, m) => {
    const k = tscale ? Math.min(2.2, Math.max(0.35, hiShort(m, 64, 30))) : 1;
    return modal(sr, f0(m), parts.map(([r, a, t]) => [r, a, t * k]), { len: Math.min(8, len * Math.max(0.5, k)), ...extra });
  };
}

/** The piano's velocity timbre: the softer the strike, the longer the hammer stays on the string and the fewer the highs (low-pass cutoff, Hz) */
const pianoTone = (m: number, v: number): number => 900 * Math.pow(2, (m - 40) / 24) * (1 + 14 * Math.pow(v, 2.5));
/** After the dampers land, the soundboard and the undamped treble strings keep a faint ring (-24 dB, fading over a second) */
const PIANO_AFTER_RING: [number, number] = [0.063, 1.1];
/** Piano dampers: bass strings are thick and settle slowly; the highest section (above F#6) has no damper */
const pianoDamper = (m: number): number => (m >= 90 ? Infinity : m < 45 ? 0.45 : m < 70 ? 0.25 : 0.16);

const S = (render: Render, level: number, hold: 'ring' | 'damp' = 'ring', release = 0.2): SampledInstrument => ({ kind: 'sample', render, hold, level, release });
const D = (name: keyof typeof DRUMS, level: number, fixed?: number, variants = 3, tone?: (m: number, v: number) => number): SampledInstrument => ({ kind: 'sample', render: (sr, m, v) => DRUMS[name](sr, m, 1000 + v * 17 + m), hold: 'ring', level, variants, fixed, ...(tone && { tone }) });
/**
 * Drums are rendered at a forte stroke. A softer stroke drives the head or plate less hard and a felt mallet stays on longer, so fewer high modes sound
 * (a cymbal barely starts the cascade that carries its energy upward): velocity rolls off the highs above `top` Hz, down to `floor` of it for the softest stroke
 */
const stroke = (top: number | ((m: number) => number), floor: number) => (m: number, v: number): number => (typeof top === 'number' ? top : top(m)) * (floor + (1 - floor) * Math.pow(v, 2.5));

const SAMPLED = {
  // ── Plucked strings
  harp: S((sr, m) => ks(sr, f0(m), { len: Math.min(6, 5 * hiShort(m, 48, 30) + 0.6), t60: 6 * hiShort(m, 48, 28), bright: 0.35, pos: 0.28, loss: 4e-8, body: HARP_BODY, tilt: -2.2 }), 0.56),
  nylon: S((sr, m) => ks(sr, f0(m), { len: 3.2, t60: 3.4 * hiShort(m, 52, 30), bright: 0.5, pos: 0.18, loss: 6e-8, body: GUITAR_BODY, tilt: -2.3 }), 0.49, 'damp', 0.35),
  /** Lute / oud: sharp, bright, short, double-strung */
  lute: S((sr, m) => ks(sr, f0(m), { len: 2.4, t60: 2.2 * hiShort(m, 52, 30), bright: 0.8, pos: 0.1, loss: 4e-8, detune: 4, body: LUTE_BODY, tilt: -3.2 }), 0.375, 'damp', 0.25),
  steel: S((sr, m) => ks(sr, f0(m), { len: 4, t60: 4.5 * hiShort(m, 52, 30), bright: 0.85, pos: 0.13, loss: 2e-8, body: STEEL_BODY, tilt: -2.75 }), 0.375, 'damp', 0.4),
  /** Hammered dulcimer: double-strung, bright, long */
  dulcimer: S((sr, m) => ks(sr, f0(m), { len: 4, t60: 3.5 * hiShort(m, 60, 30), bright: 0.9, pos: 0.12, loss: 2e-8, detune: 6, body: DULCIMER_BODY, tilt: -3 }), 0.34),
  pizz: S((sr, m) => ks(sr, f0(m), { len: 0.9, t60: 0.55 * hiShort(m, 48, 36), bright: 0.3, pos: 0.3, loss: 8e-8, body: VIOLIN_BODY, tilt: -1.1 }), 0.33),
  /** Plucked bass (double bass pizzicato) */
  pizzBass: { ...S((sr, m) => pluckAdd(sr, f0(m), { len: 2.2, t60: 1.6 * hiShort(m, 36, 24), pos: 0.22, tilt: 0.85, body: [98, 196], thump: 0.35 }), 1.1, 'damp', 0.35), minHold: 0.32 },
  // ── Struck melodic instruments
  /** Kalimba: a steel tine clamped at one end, so its second mode sits near 6× (not a harmonic), plucked by the thumb */
  kalimba: S(modalInst([[1, 1, 1.6], [5.95, 0.3, 0.4], [2.0, 0.05, 0.5]], 2.2, { mallet: 3500, click: { amp: 0.15, t: 0.006, hz: 3000 } }), 0.55),
  /** Marimba: rosewood bars undercut to 1 : 4 : ~9-10, a tube under each reinforcing the fundamental; the overtones of a wooden bar die a few times faster */
  marimba: S(modalInst([[1, 1, 1.1], [3.93, 0.4, 0.4], [9.2, 0.2, 0.1]], 1.6, { attack: 0.0015, mallet: 2000, click: { amp: 0.35, t: 0.018, hz: 2.6, q: 0.7 } }), 0.65),
  vibes: S(modalInst([[1, 1, 3.5], [4.0, 0.2, 0.8], [10, 0.04, 0.15]], 4, { trem: [5.5, 0.35], attack: 0.002 }), 0.5, 'damp', 0.6),
  /** Glockenspiel: free steel bars (1 : 2.76 : 5.4), struck with hard mallets; steel barely damps them, so they ring long */
  glock: S(modalInst([[1, 1, 3.4], [2.76, 0.35, 1.3], [5.4, 0.15, 0.55]], 4, { click: { amp: 0.1, t: 0.004, hz: 7000 } }), 0.3),
  /** Celesta: steel bars like a glockenspiel's (1 : 2.76 : 5.4) over wooden resonator boxes, struck by felt hammers */
  celesta: S(modalInst([[1, 1, 1.4], [2.76, 0.3, 0.6], [5.4, 0.12, 0.25]], 2, { mallet: 1800, click: { amp: 0.06, t: 0.005, hz: 5000 } }), 0.5),
  /** Music box: comb teeth are cantilevers (clamped at one end: 1 : 6.27 : 17.6), plucked by steel pins */
  musicbox: S(modalInst([[1, 1, 1.5], [6.27, 0.3, 0.35], [17.55, 0.1, 0.1]], 2.2, { click: { amp: 0.12, t: 0.003, hz: 6000 }, beat: 2 }), 0.49),
  /** Church bell: hum, prime, minor-third tierce, fifth, nominal (the pitch you hear) */
  bell: S((sr, m) => modal(sr, f0(m) / 2, [[0.5, 0.55, 9], [1, 0.7, 6], [1.183, 0.5, 4.5], [1.506, 0.28, 3.5], [2, 1, 4], [2.514, 0.3, 2.2], [2.662, 0.25, 2], [3.011, 0.2, 1.6], [4.166, 0.1, 1]], { len: 7, beat: 2.5, click: { amp: 0.2, t: 0.01, hz: 4000, q: 0.7 } }), 0.4),
  /**
   * Tubular bell: a free tube's modes go as (2n+1)², 9 : 25 : 49 : 81 : 121 : 169 : 225; modes 4, 5 and 6 fall near 2 : 3 : 4, and the ear hears the
   * strike note an octave below mode 4, where no partial is. Modes 1 and 2 are too low to radiate much, mode 3 adds the clang
   */
  chime: S((sr, m) => modal(sr, f0(m), [[0.617, 0.08, 4.5], [1.21, 0.3, 4], [2, 1, 3.5], [2.98, 0.8, 2.8], [4.12, 0.5, 2], [5.47, 0.28, 1.4], [7.0, 0.14, 0.9]], { len: 4, click: { amp: 0.25, t: 0.006, hz: 5000 } }), 0.4),
  steelpan: S(modalInst([[1, 1, 1.4], [2, 0.55, 0.9], [3, 0.22, 0.5], [4.02, 0.1, 0.3]], 1.8, { bend: 1.02, bendT: 0.02, click: { amp: 0.1, t: 0.008, hz: 2500 } }), 0.5),
  piano: { ...S((sr, m) => piano(sr, m), 0.75, 'damp', 0.3), tone: (m, v) => pianoTone(m, v), damper: pianoDamper, afterRing: PIANO_AFTER_RING, spread: 0.35 },
  /** Soft piano (felt-muted, used for narrative and the ending) */
  softPiano: { ...S((sr, m) => piano(sr, m, true), 0.8, 'damp', 0.45), tone: (m, v) => pianoTone(m, v) * 0.8, damper: (m) => pianoDamper(m) * 1.4, afterRing: PIANO_AFTER_RING, spread: 0.35 },
  epiano: S((sr, m) => epiano(sr, m), 0.6, 'damp', 0.3),
  /** Reversed piano (Rift, memories): swells in from nothing and is sucked in on the beat */
  revPiano: S((sr, m) => {
    const d = piano(sr, m, true).slice(0, Math.floor(sr * 1.8));
    d.reverse();
    return d;
  }, 0.6),
  // ── Drums (pitch is passed to tuned drums)
  kick: D('kick', 0.9, 36, 3, stroke(8000, 0.08)),
  boom: D('boom', 0.9, 36, 2),
  snare: D('snare', 0.55, 38, 3, stroke(18000, 0.25)),
  field: D('field', 0.5, 38, 3, stroke(18000, 0.25)),
  rim: D('rim', 0.4, 37, 3, stroke(18000, 0.25)),
  clap: D('clap', 0.9, 39),
  hat: D('hat', 0.6, 42, 4),
  ohat: D('ohat', 0.55, 46, 3, stroke(22000, 0.35)),
  ride: D('ride', 0.5, 51, 2, stroke(22000, 0.3)),
  crash: D('crash', 0.3, 49, 2, stroke(22000, 0.25)),
  swell: D('swell', 0.3, 49, 1),
  shaker: D('shaker', 0.25, 70, 4),
  tamb: D('tamb', 0.45, 54),
  taiko: D('taiko', 0.95, undefined, 3, stroke(8000, 0.08)),
  frame: D('frame', 0.7, undefined, 3, stroke(8000, 0.08)),
  darbuka: D('darbuka', 0.6, undefined, 3, stroke(8000, 0.08)),
  tom: D('tom', 0.7, undefined, 3, stroke(8000, 0.08)),
  /** Felt mallets: the roll-off follows the drum's pitch; four variants so a roll does not repeat */
  timpani: D('timpani', 0.8, undefined, 4, stroke((m) => 8 * f0(m || 38), 0.15)),
  woodblock: D('woodblock', 0.4),
  clave: D('clave', 0.3, 75),
  anvil: D('anvil', 0.3),
  gong: D('gong', 0.5, undefined, 1),
  thunder: D('thunder', 0.6, 30, 2),
  thunderclap: D('thunderclap', 0.8, 30, 2),
  chain: D('chain', 0.3, 60),
  snap: D('snap', 0.35, 60),
  brush: D('brush', 0.3, 60),
  drip: D('drip', 0.25),
  // ── Short samples for fast figures
  spicc: S((sr, m) => spicc(sr, m), 0.55),
  brassStab: S((sr, m) => brassStab(sr, m), 0.55),
} satisfies Record<string, SampledInstrument>;

/** Ambience beds: stereo (two seeds), seamless loops; pitch is meaningless */
const AMBIENCE_LEVEL = { wind: 0.4, sea: 0.4, fire: 0.35, crickets: 0.2, rain: 0.25, void: 0.17, cave: 0.25 } satisfies Record<keyof typeof AMB, number>;
const AMBIENCE = Object.fromEntries(
  Object.entries(AMB).map(([name, render]): [string, SampledInstrument] => [
    name,
    { kind: 'sample', render: (sr) => [render(sr, 11), render(sr, 29)], hold: 'damp', level: AMBIENCE_LEVEL[name as keyof typeof AMB], fixed: 60, loop: true },
  ]),
) as Record<keyof typeof AMB, SampledInstrument>;

/** Volume of live-synthesized instruments (roughly aligned with the sampled instruments) */
const LIVE_LEVEL: Partial<Record<keyof typeof VOICES, number>> = {
  flute: 0.7, panflute: 0.7, ocarina: 0.7, whistle: 0.7,
  oboe: 1.4, bassoon: 1.4, sax: 1, tenorSax: 1, trumpet: 1.3, trombone: 1.1,
  choir: 0.36, choirO: 0.3, choirOo: 0.26, menChoir: 0.37, chant: 0.31, soprano: 0.55,
  throat: 0.6, organ: 1.2, organFull: 1.2, accordion: 1.4, drone: 2,
  warmPad: 1.3, darkPad: 1.3, airPad: 5, synthLead: 1.4, powerGtr: 1.4, muteGtr: 1.4,
  bass: 0.5, synthBass: 0.5, sub: 0.5, distBass: 0.7,
};

/** Live instruments that can glide between notes */
const LIVE_GLIDERS = new Set<string>(['flute', 'panflute', 'ocarina', 'whistle', 'clarinet', 'oboe', 'bassoon', 'sax', 'tenorSax', 'horn', 'trumpet', 'trombone', 'soprano', 'synthLead', 'synthBass', 'sub']);
/** Bowed instruments that can glide between notes */
const BOWED_GLIDERS = new Set<string>(['violin', 'cello', 'fiddle', 'morin', 'strings']);

const LIVE = Object.fromEntries(
  Object.entries(VOICES).map(([name, voice]): [string, LiveInstrument] => [name, { kind: 'live', voice, level: LIVE_LEVEL[name as keyof typeof VOICES] ?? 1, glide: LIVE_GLIDERS.has(name) }]),
) as Record<keyof typeof VOICES, LiveInstrument>;

/** Bowed strings: ensemble samples of players, computed offline (bowed.ts) */
const BOWED = Object.fromEntries(
  Object.entries(BOWS).map(([name, b]): [string, SampledInstrument] => {
    const key = 'share' in b ? b.share : name;
    let seed = 0;
    for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const render: Render = (sr, m, v) => bowSample(sr, f0(m), b.def, v === 1, seed + m * 101 + v);
    return [name, { kind: 'sample', render, hold: 'damp', level: b.level, release: b.release, bow: { ...b, name: key }, glide: BOWED_GLIDERS.has(name) }];
  }),
) as Record<keyof typeof BOWS, SampledInstrument>;

export const BUILT_IN = { ...SAMPLED, ...AMBIENCE, ...LIVE, ...BOWED } satisfies Record<string, InstrumentDef>;

/** The name of a built-in instrument */
export type BuiltInInstrument = keyof typeof BUILT_IN;
