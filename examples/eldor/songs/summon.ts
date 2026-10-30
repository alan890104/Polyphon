// Music for the Astralgate summon (D major): it follows the performance, switched by summonMusic.ts at cue points. It uses the same engine and orchestra as the other scenes.
//   idle      Summon pool screen: a loop of bouncing bass, harp arpeggios and light drums; the hook melody is sung every two rounds (16 bars)
//   build     Summon pressed: strings on a suspended chord swell, noise rises, a snare roll gets denser, the kick speeds up; everything is pulled out the instant the meteor launches
//   drop      Meteor flight: only a single sub-bass line is left, so the meteor's Doppler effect sings alone
//   upgrade   Purple to gold: a fast upward glide + a golden major triad
//   gate      Gate opens: cymbal and timpani, then a tense pulsing loop (the R/SR reveal rides on top of it)
//   fanfare   SSR nameplate: a two-bar fanfare theme, flavored by element, then into a bright afterglow loop
//   resolve   Result: an IV, V, I cadence + bells rising, back to idle

import { arpeggio, bassline, chords, melody, pad, rest, rhythm, sequence, type Note, type Part, type Song } from 'polyphon';

/** A spirit's element (each one colors its summon fanfare) */
type Element = 'fire' | 'water' | 'nature' | 'thunder' | 'wind' | 'earth' | 'light' | 'dark' | 'neutral';

/** Loop tempo */
export const LOOP_BPM = 104;
/** Fanfare tempo */
export const FANFARE_BPM = 128;

const HOOK = 'D5:2 E5:2 F#5:2 A5:2 F#5:2 E5:2 D5:4 | C#5:2 E5:2 A5:4 G#5:2 F#5:2 E5:4 | G5:3 F#5:1 E5:2 D5:2 B4:2 D5:2 G5:4 | F#5:2 E5:2 C#5:4 D5:8';
const HOOK_UP = 'D6:2 E6:2 F#6:2 A6:2 F#6:2 E6:2 D6:4 | C#6:2 E6:2 A6:4 G#6:2 F#6:2 E6:4 | G6:3 F#6:1 E6:2 D6:2 B5:2 D6:2 G6:4 | F#6:2 E6:2 C#6:4 D6:8';
const EIGHT = 'D | A | Bm | G | D | A | G | A';
/** One glockenspiel note every two bars: two octaves above the chord's third */
const SPARKLE = 'A6:10 r:6 | R | F#6:10 r:6 | R | A6:10 r:6 | R | D6:10 r:6 | R';

/** The summon pool screen loop: 16 bars, the hook melody only in bars 5 to 8 */
export const idle: Song = {
  title: '星門',
  description: '卡池畫面的輕快循環',
  bpm: LOOP_BPM,
  reverb: { size: 1.8, damp: 0.35, mix: 0.85 },
  tracks: [
    { name: '和弦墊', instrument: 'warmPad', part: pad(chords(`${EIGHT} | ${EIGHT}`), { center: 66, size: 4 }), gain: 0.55, reverb: 0.4, params: { attack: 0.25, release: 0.3, cut: 1500 } },
    { name: '貝斯', instrument: 'bass', part: bassline(chords(`${EIGHT} | ${EIGHT}`), 'x--...x-x--.x-x-', '1 1 1 5 8', { register: 33 }), gain: 0.9 },
    { name: '豎琴', instrument: 'harp', part: arpeggio(chords(EIGHT), '0.12.3..4.56.7..', { step: 1, center: 66, size: 4 }), gain: 0.55, pan: -0.25, reverb: 0.35 },
    { name: '勾子', instrument: 'flute', part: sequence(rest(4), HOOK, rest(8)), gain: 0.8, pan: 0.15, reverb: 0.35 },
    { name: '鐘琴', instrument: 'glock', part: SPARKLE, gain: 0.4, pan: 0.3, reverb: 0.5 },
    { name: '大鼓', instrument: 'kick', part: rhythm('x.......x.......'), gain: 0.55, reverb: 0.05 },
    { name: '拍手', instrument: 'clap', part: rhythm('....x.......x...'), gain: 0.35, reverb: 0.2 },
    { name: '鈸', instrument: 'hat', part: rhythm('x.xox.xox.xox..o'), gain: 0.45, pan: 0.2, reverb: 0.1 },
    { name: '開鈸', instrument: 'ohat', part: rhythm('..............x.'), gain: 0.4, pan: 0.2, reverb: 0.1 },
  ],
};

/** Afterglow after an SSR: the same loop, brighter, sung every round, with choir and glockenspiel layered on the melody */
export const afterglow: Song = {
  title: '星門・餘韻',
  description: 'SSR 揭曉後的明亮循環',
  bpm: LOOP_BPM,
  reverb: { size: 2.0, damp: 0.3, mix: 0.9 },
  tracks: [
    { name: '和弦墊', instrument: 'warmPad', part: pad(chords(EIGHT), { center: 66, size: 4 }), gain: 0.65, reverb: 0.4, params: { attack: 0.25, release: 0.3, cut: 2400 } },
    { name: '合唱', instrument: 'choirOo', part: pad(chords(EIGHT), { center: 62, size: 3 }), gain: 0.6, reverb: 0.55, params: { attack: 0.5 } },
    { name: '貝斯', instrument: 'bass', part: bassline(chords(EIGHT), 'x--...x-x--.x-x-', '1 1 1 5 8', { register: 33 }), gain: 0.9 },
    { name: '豎琴', instrument: 'harp', part: arpeggio(chords(EIGHT), '0.12.3..4.56.7..', { step: 1, center: 66, size: 4 }), gain: 0.6, pan: -0.25, reverb: 0.35 },
    { name: '勾子', instrument: 'flute', part: sequence(HOOK, HOOK), gain: 0.95, pan: 0.15, reverb: 0.35 },
    { name: '勾子高八度', instrument: 'glock', part: sequence(HOOK_UP, HOOK_UP), gain: 0.3, pan: -0.1, reverb: 0.45 },
    { name: '鐘琴', instrument: 'glock', part: SPARKLE, gain: 0.5, pan: 0.3, reverb: 0.5 },
    { name: '大鼓', instrument: 'kick', part: rhythm('x...x...x...x...'), gain: 0.6, reverb: 0.05 },
    { name: '小鼓', instrument: 'snare', part: rhythm('....x.......x...'), gain: 0.5, reverb: 0.2 },
    { name: '鈸', instrument: 'hat', part: rhythm('xoxoxoxoxoxoxo.o'), gain: 0.5, pan: 0.2, reverb: 0.1 },
    { name: '開鈸', instrument: 'ohat', part: rhythm('..............x.'), gain: 0.45, pan: 0.2, reverb: 0.1 },
  ],
};

/** Tense pulse after the gate opens: Dsus2 never resolves, and the celesta up high ticks like the second hand of a countdown (2 bars) */
export const tension: Song = {
  title: '星門・開門',
  description: '揭曉前的脈動',
  bpm: LOOP_BPM,
  reverb: { size: 1.6, damp: 0.45, mix: 0.8 },
  tracks: [
    { name: '和弦墊', instrument: 'warmPad', part: melody('D4+E4+A4+D5:16 | D4+E4+A4+D5:16'), gain: 0.5, reverb: 0.4, params: { attack: 0.2, release: 0.3, cut: 1100 } },
    { name: '貝斯', instrument: 'bass', part: '!D2:2 ?D2:2 !D2:2 ?D2:2 !D2:2 ?D2:2 !D2:2 F2:2', gain: 0.9 },
    { name: '鈸', instrument: 'hat', part: rhythm('xoooxoooxoooxooo'), gain: 0.4, pan: 0.2, reverb: 0.1 },
    { name: '大鼓', instrument: 'kick', part: rhythm('x.......x.......'), gain: 0.55 },
    { name: '低鼓', instrument: 'tom', part: rhythm('......x.......x.', { pitch: 45 }), gain: 0.35, reverb: 0.2 },
    { name: '小鼓', instrument: 'snare', part: rhythm('............o...'), gain: 0.4, reverb: 0.2 },
    { name: '秒針', instrument: 'celesta', part: 'r:2 D5:2 r:2 D5:2 r:2 A5:2 r:2 D5:2', gain: 0.45, pan: -0.3, reverb: 0.4 },
    { name: '鐘琴', instrument: 'glock', part: 'R | D6:8 r:8', gain: 0.35, pan: 0.3, reverb: 0.5 },
  ],
};

// ───────────────────────── One-shot sections (bpm 60: one step = 0.25 s, so they are easy to lay out in seconds) ─────────────────────────

const S = (sec: number) => sec * 4;
const once = (title: string, tracks: Song['tracks'], size = 1.8): Song => ({ title, description: '', bpm: 60, loop: false, reverb: { size, damp: 0.4, mix: 0.85 }, tracks: tracks.map((t) => ({ humanize: 0, ...t })) });
const part = (notes: Note[], duration: number): Part => ({ notes, duration });
const hit = (sec: number, v = 0.8, m: number[] = []): Note => ({ time: S(sec), duration: 1, pitches: m, velocity: v });

/** Summon pressed: the meteor launches after dur seconds */
export function build(dur: number): Song {
  const L = S(dur);
  const snares: Note[] = [];
  const hats: Note[] = [];
  let t = 0;
  let gap = 0.17;
  while (t < dur - 0.02) {
    const k = t / dur;
    snares.push(hit(t, 0.2 + 0.8 * k));
    if (k > 0.75) hats.push(hit(t, 0.7));
    t += gap;
    gap = Math.max(0.038, gap * 0.86);
  }
  const kicks: Note[] = [];
  for (let tk = 0; tk < dur - 0.05; tk += 0.29) kicks.push(hit(tk, 0.5 + 0.35 * (tk / dur)));
  kicks.push(hit(dur - 0.02, 1));
  const end = L + S(1.2);
  return once('召喚・蓄力', [
    { instrument: 'strings', part: part([{ time: 0, duration: L, pitches: [57, 62, 64, 69], velocity: 0.9 }], end), gain: 0.9, reverb: 0.4, params: { attack: dur * 0.9, release: 0.15 } },
    { instrument: 'choirOo', part: part([{ time: L * 0.4, duration: L * 0.6, pitches: [57, 64], velocity: 0.8 }], end), gain: 0.8, reverb: 0.5, params: { attack: dur * 0.5, release: 0.15 } },
    { instrument: 'riser', part: part([{ time: 0, duration: S(dur + 0.9), pitches: [60], velocity: 0.7 }], end), gain: 0.7, reverb: 0.3 },
    { instrument: 'snare', part: part(snares, end), gain: 0.5, reverb: 0.25 },
    { instrument: 'hat', part: part(hats, end), gain: 0.4 },
    { instrument: 'kick', part: part(kicks, end), gain: 0.7 },
    { instrument: 'bass', part: part([{ time: 0, duration: L / 2, pitches: [38], velocity: 0.7 }, { time: L / 2, duration: L / 2, pitches: [45], velocity: 0.75 }], end), gain: 0.9 },
    { instrument: 'crash', part: part([hit(dur - 0.02, 0.6)], end), gain: 0.6, reverb: 0.3 },
  ]);
}

/** Meteor flight: the sub-bass on D1 */
export const drop: Song = once('召喚・流星', [{ instrument: 'sub', part: part([{ time: 0, duration: S(0.8), pitches: [26], velocity: 0.8 }], S(1.6)), params: { attack: 0.15, release: 0.5 } }]);

/** Purple to gold: an upward glide, a golden D major triad */
export const upgrade: Song = once('召喚・升金', [
  { instrument: 'synthLead', part: part([{ time: 0, duration: S(0.3), pitches: [57], velocity: 0.6, glide: true }, { time: S(0.3), duration: 0.4, pitches: [93], velocity: 0.6 }], S(1.8)), gain: 0.5, params: { glide: 0.3, release: 0.05 } },
  { instrument: 'trumpets', part: part([{ time: S(0.3), duration: S(0.9), pitches: [62, 66, 69, 74], velocity: 0.85, strum: 0.03 }], S(1.8)), gain: 0.8, reverb: 0.4 },
  { instrument: 'choir', part: part([{ time: S(0.3), duration: S(1.2), pitches: [62, 69], velocity: 0.85 }], S(1.8)), gain: 0.8, reverb: 0.5, params: { attack: 0.1 } },
  { instrument: 'timpani', part: part([hit(0.3, 0.9, [38])], S(1.8)), gain: 0.8 },
  { instrument: 'crash', part: part([hit(0.3, 0.7)], S(1.8)), gain: 0.6, reverb: 0.3 },
]);

/** The gate-opening hit (summonMusic then starts the tense loop) */
export const gate: Song = once('召喚・開門', [
  { instrument: 'crash', part: part([hit(0, 0.8)], S(1)), gain: 0.65, reverb: 0.3 },
  { instrument: 'timpani', part: part([hit(0, 0.9, [38])], S(1)), gain: 0.85 },
]);

/** Dark element: press the major scale's 3rd, 6th and 7th degrees down into minor */
const minor = (m: number): number => {
  const pc = (((m - 2) % 12) + 12) % 12;
  return pc === 4 || pc === 9 || pc === 11 ? m - 1 : m;
};

/** SSR fanfare (2 bars, 128 BPM), flavored by element; when it ends summonMusic hands over to the afterglow loop */
export function fanfare(el: Element): Song {
  const trn = el === 'earth' ? -2 : 0;
  const fix = (m: number) => (el === 'dark' ? minor(m) : m) + trn;
  const E = 2; // eighth note = 2 steps
  const MEL: [number, number, number][] = [[74, 0, 1], [69, 1, 1], [74, 2, 1], [78, 3, 1], [81, 4, 2], [78, 6, 1], [81, 7, 1], [83, 8, 2], [81, 10, 1], [78, 11, 1], [86, 12, 4]];
  const mev = (k = 0): Note[] => MEL.map(([m, s, l]) => ({ time: s * E, duration: l * E * 0.95, pitches: [fix(m) + k], velocity: 0.85 }));
  const LEN = 32;
  const CH: [number[], number, number][] = [[[50, 62, 66, 69, 74], 0, 8], [[43, 55, 59, 62, 67], 8, 2], [[45, 57, 61, 64, 69], 10, 2], [[50, 62, 66, 69, 74], 12, 6]];
  const padEv: Note[] = [];
  const choirEv: Note[] = [];
  const bassEv: Note[] = [];
  for (const [ch, s, l] of CH) {
    const tones = ch.slice(1).map(fix);
    padEv.push({ time: s * E, duration: l * E, pitches: tones, velocity: 0.8 });
    choirEv.push({ time: s * E, duration: l * E, pitches: tones.slice(0, 3), velocity: 0.8 });
    bassEv.push({ time: s * E, duration: l * E * 0.9, pitches: [ch[0] - 12 + trn], velocity: 0.9 });
  }
  const kick: Note[] = [];
  const hat: Note[] = [];
  const ohat: Note[] = [];
  const snare: Note[] = [];
  const timp: Note[] = [];
  const snap: Note[] = [];
  for (let i = 0; i < 16; i += 2) {
    kick.push({ time: i * E, duration: 1, pitches: [], velocity: 0.85 });
    (el === 'wind' && i % 4 === 2 ? ohat : hat).push({ time: i * E, duration: 1, pitches: [], velocity: 0.8 });
    hat.push({ time: (i + 1) * E, duration: 1, pitches: [], velocity: 0.45 });
    if (i % 4 === 2) snare.push({ time: i * E, duration: 1, pitches: [], velocity: 0.9 });
    if (i % 8 === 0 || i === 12) timp.push({ time: i * E, duration: 1, pitches: [el === 'earth' ? 36 : 38], velocity: el === 'earth' ? 1 : el === 'fire' ? 0.9 : 0.8 });
    if (el === 'thunder') {
      if (i % 4 === 0) snap.push({ time: i * E, duration: 1, pitches: [], velocity: 1 });
      snare.push({ time: (i + 1) * E, duration: 1, pitches: [], velocity: 0.4 });
    }
  }
  if (el === 'dark') for (const d of [0.55, 0.9]) timp.push({ time: 12 * E + d * (FANFARE_BPM / 60) * 4, duration: 1, pitches: [33], velocity: 0.8 });
  const tracks: Song['tracks'] = [
    { name: '號角', instrument: 'trumpets', part: part(mev(), LEN), gain: 0.9, reverb: 0.35, humanize: 0 },
    { name: '和弦墊', instrument: 'warmPad', part: part(padEv, LEN), gain: 0.55, reverb: 0.4, params: { attack: 0.05, cut: 2200 } },
    { name: '合唱', instrument: 'choir', part: part(choirEv, LEN), gain: el === 'water' || el === 'light' ? 0.85 : 0.6, reverb: 0.5, params: { attack: 0.08 } },
    { name: '貝斯', instrument: 'bass', part: part(bassEv, LEN), gain: 0.9 },
    { name: '大鼓', instrument: 'kick', part: part(kick, LEN), gain: 0.7 },
    { name: '鈸', instrument: 'hat', part: part(hat, LEN), gain: 0.45, pan: 0.2 },
    { name: '小鼓', instrument: 'snare', part: part(snare, LEN), gain: 0.55, reverb: 0.2 },
    { name: '定音鼓', instrument: 'timpani', part: part(timp, LEN), gain: 0.85, reverb: 0.25 },
    { name: '過門', instrument: 'tom', part: part([52, 48, 43].map((m, i) => ({ time: 10 * E + i, duration: 1, pitches: [m], velocity: 0.8 })), LEN), gain: 0.6, reverb: 0.2 },
    { name: '鈸', instrument: 'crash', part: part([{ time: 0, duration: 1, pitches: [], velocity: 0.8 }, { time: 12 * E, duration: 1, pitches: [], velocity: 0.9 }], LEN), gain: 0.6, reverb: 0.3 },
    { name: '地鳴', instrument: 'boom', part: part([{ time: 0, duration: 1, pitches: [], velocity: 0.8 }, { time: 12 * E, duration: 1, pitches: [], velocity: 0.9 }], LEN), gain: 0.7 },
  ];
  if (ohat.length) tracks.push({ instrument: 'ohat', part: part(ohat, LEN), gain: 0.45, pan: 0.2 });
  if (snap.length) tracks.push({ instrument: 'snap', part: part(snap, LEN), gain: 0.7, reverb: 0.2 });
  if (el === 'fire') tracks.push({ name: '火：低八度的長號', instrument: 'trombone', part: part(mev(-12), LEN), gain: 0.6, reverb: 0.3 });
  if (el === 'nature') tracks.push({ name: '自然：豎琴高八度', instrument: 'harp', part: part(mev(12), LEN), gain: 0.55, pan: -0.3, reverb: 0.4 });
  if (el === 'wind') tracks.push({ name: '風：長笛高八度', instrument: 'flute', part: part(mev(12), LEN), gain: 0.6, pan: 0.3, reverb: 0.4 });
  if (el === 'light') tracks.push({ name: '光：鐘琴高八度', instrument: 'glock', part: part(mev(12), LEN), gain: 0.5, pan: 0.3, reverb: 0.5 });
  if (el === 'neutral') tracks.push({ name: '無：木頭的敲擊', instrument: 'rim', part: part(mev().map((e) => ({ ...e, pitches: [] })), LEN), gain: 0.5 });
  if (el === 'water') tracks.push({ name: '水：往上滑的正弦', instrument: 'sub', part: part([{ time: 0, duration: 1, pitches: [57], velocity: 0.5, glide: true }, { time: 1, duration: 10, pitches: [76], velocity: 0.5 }], LEN), gain: 0.35, reverb: 0.6, params: { glide: 1.0, release: 0.3 } });
  if (el === 'thunder') tracks.push({ name: '雷：銅管重音', instrument: 'brassStab', part: part([0, 8, 12].map((s) => ({ time: s * E, duration: 1, pitches: [74, 78, 81], velocity: 0.8 })), LEN), gain: 0.5, reverb: 0.25 });
  return { title: '召喚・SSR', description: '', bpm: FANFARE_BPM, loop: false, reverb: { size: 2.2, damp: 0.35, mix: 0.9 }, tracks };
}

/** Resolve: IV, V, I, bells rising */
export const resolve: Song = once('召喚・結算', [
  { instrument: 'warmPad', part: part([[[55, 59, 62, 67], 0, 0.42], [[57, 61, 64, 69], 0.42, 0.42], [[62, 66, 69, 74], 0.84, 2.2]].map(([m, t, d]) => ({ time: S(t as number), duration: S(d as number), pitches: m as number[], velocity: 0.85 })), S(4)), gain: 0.6, reverb: 0.4, params: { attack: 0.03, cut: 2400 } },
  { instrument: 'harp', part: part([[[67, 71, 74, 79], 0], [[69, 73, 76, 81], 0.42], [[74, 78, 81, 86], 0.84]].map(([m, t]) => ({ time: S(t as number), duration: S(0.6), pitches: m as number[], velocity: 0.8, strum: 0.03 })), S(4)), gain: 0.6, reverb: 0.4 },
  { instrument: 'bass', part: part([[31, 0, 0.42], [33, 0.42, 0.42], [38, 0.84, 2.0]].map(([m, t, d]) => ({ time: S(t), duration: S(d), pitches: [m], velocity: 0.9 })), S(4)), gain: 0.9 },
  { instrument: 'kick', part: part([0, 0.42, 0.84].map((t) => hit(t, 0.85)), S(4)), gain: 0.65 },
  { instrument: 'crash', part: part([hit(0.84, 0.6)], S(4)), gain: 0.55, reverb: 0.3 },
  { instrument: 'celesta', part: part([74, 78, 81, 86, 90].map((m, i) => ({ time: S(0.9 + i * 0.07), duration: S(1.6), pitches: [m], velocity: 0.8 })), S(4)), gain: 0.6, pan: 0.25, reverb: 0.5 },
  { instrument: 'choirOo', part: part([{ time: S(0.84), duration: S(2.2), pitches: [62, 69], velocity: 0.8 }], S(4)), gain: 0.7, reverb: 0.5, params: { attack: 0.2 } },
]);

/** Time to return to idle after the result (seconds) */
export const RESOLVE_TO_IDLE = 3.0;
/** Length of the SSR fanfare (seconds): the afterglow follows */
export const FANFARE_SEC = (32 * 60) / FANFARE_BPM / 4;
