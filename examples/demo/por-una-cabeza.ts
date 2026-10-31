// Carlos Gardel, "Por una cabeza" (1935, words by Alfredo Le Pera), remade as electro tango, as Gotan Project and Bajofondo set tango over
// electronics. The tune is untouched (the solo violin sings it, the cellos answer, the violins take it up in octaves); around it the strings
// and piano of an orquesta típica and a modern beat whose kick plays tango's own 3-3-2, the síncopa the piano and the bass already play.
//   intro (8 bars)        the falling bass, A G F E, under Am G6 Dm E7, the piano's marcato muffled and opening up; hats, then the synth
//                         bass and the kick, a riser and a snare fill into
//   refrain (8)           the beat: kick, clap on 2 and 4, hats with an open hat before each bar; the violin sings, the cellos answer, to
//                         the half close on E7; the beat drops out into
//   strain (16)           a new strain, written for this arrangement and still in A minor: a solo cello sings it over the muffled
//                         marcato as the bass goes round the circle of fifths, the violin echoing it; then the violin takes it up as
//                         the bass climbs by semitones to E and the track builds layer by layer to its loudest, and stops dead: a
//                         beat of nothing, even the room cut, before
//   last refrains (15)    everything: the violin an octave up, the violas and cellos answering in octaves, a plucked synth in
//                         sixteenths; the second time the violins join the tune in octaves
//   the close (2)         the last bar broadening, the tune lands on A with the whole orchestra on A minor, and the chord dies away
//                         from the top down, the low A ringing last
// The notes: Gardel's tune and harmony, read out of a solo nylon-guitar MIDI and checked against the original voice-and-piano score as typeset
// by mfiles.co.uk ("Tango canción", in A and 4/8, written here in 4/4 with every value doubled). Gardel and Le Pera died in 1935: the song has
// been in the public domain in Argentina since 2006, and most likely is in the US (no renewal was found). The tune, its harmony and the chorus
// answer are Gardel's; everything else, the middle strain included, is this arrangement's. ♩ = 116, steady, as a dance floor wants it, until the last bar.

import { defineSong, melody, rhythm, sequence, slice, stack, transpose, type Note, type Part, type Sweep } from 'polyphon';

const PLAYERS = [
  'violin', 'violins', 'violinSwells', 'violas', 'innerStrings', 'cello', 'cellos', 'pizz', 'piano',
  'bass', 'pad', 'pluck', 'kick', 'clap', 'snare', 'hat', 'openHat', 'shaker', 'crash', 'riser', 'impact',
] as const;
type Player = (typeof PLAYERS)[number];
type Passage = Record<Player, Part>;

/** Dynamics, as velocity scales */
const P = 0.62;
const MF = 0.86;
const F = 1.02;
const FF = 1.1;

const m = (source: string) => melody(source);
const octave = (part: Part, n: number) => transpose(part, 12 * n);
const bars = (from: number, to: number) => (part: Part) => slice(part, (from - 1) * 16, to * 16);

/** Detached: each note sounds for `k` of its length */
function staccato(part: Part, k = 0.5): Part {
  return { ...part, notes: part.notes.map((n) => ({ ...n, duration: n.duration * k })) };
}

/** Every note `k` times as strong (a soloist above the passage's dynamic, or an accompaniment below it) */
function louder(part: Part, k: number): Part {
  return { ...part, notes: part.notes.map((n) => ({ ...n, velocity: Math.min(1, n.velocity * k) })) };
}

/** A line doubled an octave above */
function inOctaves(part: Part): Part {
  return { ...part, notes: part.notes.map((n) => ({ ...n, pitches: [n.pitches[0], n.pitches[0] + 12] })) };
}

/** The piano's left hand: the bass line in octaves, short */
function leftHand(bass: Part): Part {
  return { ...bass, notes: bass.notes.map((n) => ({ ...n, pitches: [n.pitches[0], n.pitches[0] + 12], duration: Math.min(n.duration, 2.5) })) };
}

/** Sung phrasing: held notes swell out, quick notes off the beat stay lighter, and each bar's first note leans a little */
function sing(line: Part): Part {
  const weight = (n: Note) => (n.duration >= 8 ? 1.12 : n.duration >= 4 ? 1.05 : n.time % 4 ? 0.93 : 1) * (n.time % 16 === 0 ? 1.05 : 1);
  return { ...line, notes: line.notes.map((n) => ({ ...n, velocity: Math.min(1, n.velocity * weight(n)) })) };
}

/**
 * Where the rhythm section's chords fall in a bar, [step, velocity]: M marcato (all four beats, the first and third leaning), S síncopa
 * (3-3-2), H the strong beats (1 and 3), O the weak ones (2 and 4), T three beats and a stop, 1 the downbeat alone, - silent. The strong
 * hits go above full velocity so they stay accented when a soft passage's dynamic scales them down
 */
const PATTERNS: Record<string, [number, number][]> = {
  M: [[0, 1.15], [4, 0.82], [8, 1.02], [12, 0.82]],
  S: [[0, 1.15], [6, 1.1], [12, 1.1]],
  H: [[0, 1.15], [8, 1.02]],
  O: [[4, 0.9], [12, 0.9]],
  T: [[0, 1.15], [4, 0.9], [8, 1.1]],
  '1': [[0, 1.15]],
  '-': [],
};

/** Short chords from a harmony (its chords held as long as they last), one pattern letter per bar */
function comp(harmony: Part, pattern: string, len = 1.5): Part {
  const notes: Note[] = [];
  [...pattern.replace(/\s/g, '')].forEach((letter, bar) => {
    for (const [step, velocity] of PATTERNS[letter]) {
      const t = bar * 16 + step;
      const chord = harmony.notes.find((n) => n.time <= t && t < n.time + n.duration);
      if (chord) notes.push({ time: t, duration: len, pitches: chord.pitches, velocity });
    }
  });
  return { notes, duration: harmony.duration };
}

/**
 * A passage for the whole orchestra at one dynamic (or a hairpin from one to another): the players it leaves out rest.
 * Every part in it must last as long as the others.
 */
function passage(dynamic: number | [number, number], players: Partial<Passage>): Passage {
  const entries = Object.entries(players) as [Player, Part][];
  const length = entries[0][1].duration;
  for (const [name, p] of entries) if (Math.abs(p.duration - length) > 1e-6) throw new Error(`${name} plays ${p.duration} steps of ${length}`);
  const [from, to] = typeof dynamic === 'number' ? [dynamic, dynamic] : dynamic;
  const level = (p: Part): Part => ({
    ...p,
    notes: p.notes.map((n) => ({ ...n, velocity: Math.min(1, n.velocity * (from + ((to - from) * n.time) / length)) })),
  });
  return Object.fromEntries(PLAYERS.map((p) => [p, players[p] ? level(players[p]) : { notes: [], duration: length }])) as Passage;
}

/** Sixteenths climbing through each chord two octaves up, the plucked synth of the last refrains */
function arp(harmony: Part): Part {
  const notes: Note[] = [];
  for (const chord of harmony.notes) {
    const tones = [...chord.pitches, chord.pitches[0] + 12].map((p) => p + 12);
    for (let t = 0; t < chord.duration; t++) notes.push({ time: chord.time + t, duration: 0.6, pitches: [tones[t % tones.length]], velocity: t % 4 ? 0.55 : 0.8 });
  }
  return { notes, duration: harmony.duration };
}

// ───────────────────────── The harmony ─────────────────────────

/** The right hand's chords, shared by the piano, the pizzicato strings and the pad */
const V = {
  Am: 'A3+C4+E4', G6: 'G3+B3+E4', Dm: 'A3+D4+F4', C: 'G3+C4+E4', B7: 'A3+D#4+F#4', DSdim: 'A3+C4+F#4', E7: 'G#3+B3+D4',
  Dm7: 'A3+C4+F4', G7: 'B3+D4+F4', Cmaj7: 'G3+B3+E4', Fmaj7: 'A3+C4+E4', Bm7b5: 'A3+D4+F4', A7: 'G3+C#4+E4',
};

/**
 * The refrain: A minor over a bass falling by semitones from A to D (G6, D minor over F, C over E), A minor over C, then the cadence; the
 * first time it closes on the dominant (B7 and F#ø7, the same chord as A minor over F#; D#°7, E7), the second on the way home (B7, E7)
 */
const refrainHarmony = (cadence: string) => m(`${V.Am}:16 | ${V.G6}:16 | ${V.Dm}:16 | ${V.C}:16 | ${V.Dm}:16 | ${V.Am}:16 | ${cadence}`);
const CADENCE_1 = `${V.B7}:8 ${V.Am}:8 | ${V.DSdim}:8 ${V.E7}:8 |`;
const CADENCE_2 = `${V.B7}:8 ${V.E7}:8 |`;
/** The refrain's bass, with the síncopa in the bars where the tune waits a beat */
const REFRAIN_BASS = `
  A2:3 r:3 A2:3 r:3 E2:3 r:1 | G2:4 r:4 G2:4 F#2:4 | F2:3 r:3 F2:3 r:3 D2:3 r:1 | E2:4 r:4 E2:4 D#2:4 |
  D2:3 r:3 D2:3 r:3 A1:3 r:1 | C2:4 r:4 A1:4 r:4 |`;
const BASS_1 = m(`${REFRAIN_BASS} B1:3 r:3 B1:3 r:3 F#2:3 r:1 | D#2:4 r:4 E2:4 r:4 |`);
const BASS_2 = m(`${REFRAIN_BASS} B1:4 r:4 E2:4 r:4 |`);

/** The falling bass the intro stands on: A G F E under Am, G6, D minor and E7, all in síncopa */
const FALL = m(`${V.Am}:16 | ${V.G6}:16 | ${V.Dm}:16 | ${V.E7}:16 |`);
const FALL_BASS = m('A2:3 r:3 A2:3 r:3 E2:3 r:1 | G2:3 r:3 G2:3 r:3 D2:3 r:1 | F2:3 r:3 F2:3 r:3 C2:3 r:1 | E2:3 r:3 E2:3 r:3 B1:3 r:1 |');

/**
 * The middle strain, written for this arrangement and staying in A minor: first the circle of fifths (A minor, D minor, G7, C, F, Bø7,
 * E7), then a bass climbing by semitones from A to E (A minor, Bø7, C, A7 over C#, D minor, D#°7, E7) while everything builds; its last
 * bar stops dead on the fourth beat
 */
const MIDDLE_HARMONY = m(`
  ${V.Am}:16 | ${V.Dm7}:16 | ${V.G7}:16 | ${V.Cmaj7}:16 | ${V.Fmaj7}:16 | ${V.Bm7b5}:16 | ${V.E7}:16 | ${V.E7}:16 |
  ${V.Am}:16 | ${V.Bm7b5}:16 | ${V.C}:16 | ${V.A7}:16 | ${V.Dm}:16 | ${V.DSdim}:16 | ${V.E7}:16 | ${V.E7}:12 r:4 |`);
/** Roots and fifths on beats 1 and 3 round the circle; then the climb in síncopa, then in eighths, and out for the last bar so the drop lands */
const MIDDLE_BASS = m(`
  A1:4 r:4 E2:4 r:4 | D2:4 r:4 A1:4 r:4 | G1:4 r:4 D2:4 r:4 | C2:4 r:4 G1:4 r:4 |
  F1:4 r:4 C2:4 r:4 | B1:4 r:4 F2:4 r:4 | E2:4 r:4 B1:4 r:4 | E2:4 r:4 B1:4 G#1:4 |
  A1:3 r:3 A1:3 r:3 E2:3 r:1 | B1:3 r:3 B1:3 r:3 F2:3 r:1 | C2:3 r:3 C2:3 r:3 G2:3 r:1 | C#2:3 r:3 C#2:3 r:3 E2:3 r:1 |
  D2:2 D2 D2 D2 D2 D2 D2 D2 | D#2:2 D#2 D#2 D#2 D#2 D#2 D#2 D#2 | E2:2 E2 E2 E2 E2 E2 E2 E2 | R |`);

// ───────────────────────── The tune ─────────────────────────

/** The refrain ("Por una cabeza, todas las locuras..."): each phrase climbs a third and falls a fourth, a step lower each time */
const REFRAIN = `
  r:4 C5:4 C5:4 D5:2 E5:2 | E5:8 B4:8 | r:4 A4:4 A4:4 B4:2 C5:2 | C5:8 G4:8 | r:4 F4:4 F4:4 G4:2 A4:2 | A4:4 E4:4 A4:2 B4 C5 A4 |`;
/** The tune the first time, to the half close, and the second, to the way home */
const TUNE_1 = m(`${REFRAIN} B4:4 F#4:4 A4:2 B4 C5 A4 | C5:8 B4:8 |`);
const TUNE_2 = m(`${REFRAIN} B4:4 F#4:4 G#4:2 A4 B4 G#4 |`);
/** The chorus's second voice from the score, answering the tune's long notes (the first time) */
const ANSWER_1 = 'R | r:4 G4:4 G4:4 F4:2 E4:2 | F4:4 F4:4 r:8 | r:4 E4:4 E4:4 D4:2 C4:2 | D4:4 D4:4 r:8 | C4:8 E4:8 | D#4:8 C4:8 | A3:8 G#3:8 |';
/** The same, the second time, closing toward E */
const ANSWER_2 = 'R | r:4 G4:4 G4:4 F4:2 E4:2 | F4:4 F4:4 r:8 | r:4 E4:4 E4:4 D4:2 C4:2 | D4:4 D4:4 r:8 | C4:8 E4:8 | D#4:8 D4:8 |';

/**
 * The middle strain's tune, in two halves of eight bars. The cello's: each phrase climbs from below in tango's 3-3-2 and sighs down from a
 * long note, a step lower round the circle, then reaches up to A for the Bø7 and falls to the leading tone. The violin's: the same climb
 * an octave up, rising this time with the bass, then long notes climbing by semitones, F, F#, G#, and a run up to D, the seventh of E7,
 * left hanging in the silence until the refrain's C answers it
 */
const CELLO_STRAIN = m(`
  r:4 E3:3 A3:3 B3:2 C4:4 | F4:6 E4:2 D4:8 | r:4 D3:3 G3:3 A3:2 B3:4 | E4:6 D4:2 C4:8 |
  r:4 A3:3 C4:3 E4:2 G4:4 | A4:6 G4:2 F4:4 D4:4 | r:4 B2:3 E3:3 F3:2 G#3:4 | B3:6 A3:2 G#3:8 |`);
const VIOLIN_STRAIN = m(`
  r:4 E4:3 A4:3 B4:2 C5:4 | F5:6 E5:2 D5:8 | r:4 G4:3 C5:3 D5:2 E5:4 | G5:6 F5:2 E5:8 |
  F5:12 E5:2 F5:2 | F#5:12 E5:2 F#5:2 | G#5:16 | G#5:4 A5:2 B5:2 D6:4 r:4 |`);

// ───────────────────────── The beat ─────────────────────────

/** A drum part from one-bar patterns, each repeated as often as asked: beat(['X...', 3], ['x...', 1]) */
const beat = (pitch: string | undefined, ...pattern: [string, number][]) => rhythm(pattern.map(([bar, n]) => bar.repeat(n)).join(''), { pitch });
const kick = (...pattern: [string, number][]) => beat('A1', ...pattern);
const hits = (...pattern: [string, number][]) => beat(undefined, ...pattern);

const NONE = '................';
/** The kick on tango's 3-3-2; in a fill's bar it drops out halfway */
const SINCOPA = 'X.....x.....x...';
const SINCOPA_FILL = 'X.....x.........';
const HALF = 'X.......X.......';
const FOUR = 'X...x...X...x...';
const BACKBEAT = '....X.......X...';
const FILL = '........oxoxXxXX';
/** Eighths with a ghost between, the last eighth left for the open hat that pushes into the next bar */
const HATS = 'x.o.x.o.x.o.x...';
const OPEN = '..............X.';
const SHAKER = 'oxXxoxXxoxXxoxXx';
const SOFT_SHAKER = 'o.x.o.x.o.x.o.x.';
const DOWNBEAT = 'X...............';
/** The last bar before a stop: three beats, then nothing */
const STOP = { kick: 'X...x...X.......', clap: '....X...........', hat: 'x.o.x.o.x.o.....', shaker: 'oxXxoxXxoxXx....' };
/** The build's snare roll: a bar each of quarters, eighths and sixteenths, then thirty-seconds, swelling, and the silent beat */
const ROLL = (() => {
  const roll = sequence(rhythm('x...'.repeat(4) + 'x.'.repeat(8) + 'x'.repeat(16)), rhythm('X'.repeat(24), { step: 0.5 }), 'r:4');
  return { ...roll, notes: roll.notes.map((n) => ({ ...n, velocity: n.velocity * (0.3 + (0.7 * n.time) / 64) })) };
})();

// ───────────────────────── Intro ─────────────────────────

/** The falling bass twice, the marcato muffled and opening; hats from bar 3, the synth bass and the kick from bar 5, a riser into the refrain */
const intro = passage([P, MF], {
  piano: stack(leftHand(sequence(FALL_BASS, FALL_BASS)), comp(sequence(FALL, FALL), 'M M M S M M M S')),
  pizz: comp(sequence(FALL, FALL), '- - - - O O O O'),
  pad: sequence(FALL, FALL),
  bass: sequence(m('R R R R'), staccato(FALL_BASS, 0.85)),
  violinSwells: m('R R R R R R R G#4+B4+E5:16 |'),
  kick: kick([NONE, 4], [HALF, 2], [SINCOPA, 1], [SINCOPA_FILL, 1]),
  clap: hits([NONE, 6], [BACKBEAT, 1], ['....X...........', 1]),
  snare: hits([NONE, 7], [FILL, 1]),
  hat: hits([NONE, 2], [HATS, 6]),
  riser: sequence(m('R R R R'), m('A4:64')),
});

// ───────────────────────── The refrain ─────────────────────────

/** The violin sings, the cellos answer, the pizzicato and the piano share the marcato and the síncopa; the beat drops out at the end */
const refrain = passage(MF, {
  violin: sing(TUNE_1),
  cellos: m(ANSWER_1),
  violinSwells: m('R R R R R R R r:8 D5+G#5:8 |'),
  piano: stack(leftHand(BASS_1), comp(refrainHarmony(CADENCE_1), 'S H S H S H S H')),
  pizz: comp(refrainHarmony(CADENCE_1), 'S O S O S O S O'),
  bass: staccato(BASS_1, 0.85),
  pad: refrainHarmony(CADENCE_1),
  kick: kick([SINCOPA, 7], [SINCOPA_FILL, 1]),
  clap: hits([BACKBEAT, 7], ['....X...........', 1]),
  hat: hits([HATS, 8]),
  openHat: hits([OPEN, 7], [NONE, 1]),
  crash: hits([DOWNBEAT, 1], [NONE, 7]),
  impact: hits([DOWNBEAT, 1], [NONE, 7]),
});

// ───────────────────────── The middle strain ─────────────────────────

/**
 * Bars 1-8, the beat gone: a solo cello sings the new strain over the muffled marcato and the bass going round the circle of fifths; the
 * violin echoes two of its sighs from above; a soft kick and a shaker come back for the second half
 */
const strain = (() => {
  const [harmony, bass] = [MIDDLE_HARMONY, MIDDLE_BASS].map(bars(1, 8));
  return passage([P, MF], {
    cello: louder(sing(CELLO_STRAIN), 1.45),
    violin: louder(m('R R R r:8 E5:3 D5:3 C5:2 | R R R r:8 B4:3 A4:3 G#4:2 |'), 1.2),
    piano: louder(stack(leftHand(bass), comp(harmony, 'M M M M M M M M')), 1.3),
    bass: louder(staccato(bass, 0.85), 1.3),
    pad: louder(harmony, 1.3),
    // Half as strong as the beat of the refrains: a pulse to breathe with, not to dance to
    kick: louder(kick([NONE, 4], [DOWNBEAT, 4]), 0.5),
    hat: louder(hits([NONE, 4], [BACKBEAT, 4]), 0.5),
    shaker: louder(hits([NONE, 4], [SOFT_SHAKER, 4]), 0.5),
    crash: hits([DOWNBEAT, 1], [NONE, 7]),
  });
})();

/**
 * Bars 9-16, the build, a layer every two bars: the violin takes the strain over the climbing bass, the cellos climbing with it; then
 * the clap, the open hats and the inner strings; then the kick in quarters, the bass in eighths, the violins, a snare roll and a riser;
 * then the roll in thirty-seconds, the kick in eighths and the strings swelling while the bass drops out, so it comes back with the
 * drop when, after a beat of nothing at all (the song's silence cuts even the room), the last refrains crash in
 */
const rise = (() => {
  const [harmony, bass] = [MIDDLE_HARMONY, MIDDLE_BASS].map(bars(9, 16));
  return passage([MF, F], {
    violin: louder(sing(VIOLIN_STRAIN), 0.85),
    cellos: m('A3:16 | B3:16 | C4:16 | C#4:16 | D4:16 | D#4:16 | E4:16 | E4:12 r:4 |'),
    violins: louder(m('R R R R A4+D5:16 | A4+C5:16 | B4+D5:16 | B4+D5:12 r:4 |'), 0.75),
    violinSwells: m('R R R r:8 C#5+G5:8 | R R R r:8 D5+G#5:4 r:4 |'),
    innerStrings: sequence(m('R R'), slice(harmony, 32, 128)),
    piano: stack(leftHand(bass), comp(harmony, 'S S S S M M M T')),
    pizz: comp(harmony, 'O O O O M M M T'),
    bass: staccato(bass, 0.85),
    pad: harmony,
    kick: kick([HALF, 4], [FOUR, 3], ['X.X.X.X.X.X.....', 1]),
    clap: hits([NONE, 2], [BACKBEAT, 5], [STOP.clap, 1]),
    snare: sequence(m('R R R R'), ROLL),
    hat: hits([HATS, 7], [STOP.hat, 1]),
    openHat: hits([NONE, 2], [OPEN, 5], [NONE, 1]),
    shaker: hits([SOFT_SHAKER, 4], [SHAKER, 3], [STOP.shaker, 1]),
    riser: sequence(m('R R R R'), m('A4:60 r:4')),
  });
})();

// ───────────────────────── The last refrains ─────────────────────────

/** After the silence, everything at once on the downbeat; then the violin an octave up, the violas and cellos answering in octaves, the plucked synth */
const finale1 = passage(FF, {
  violin: sing(octave(TUNE_1, 1)),
  // The tune waits a beat, so the strings hit the downbeat for it
  violins: m('A4+C5+E5+A5:3 r:13 | R R R R R R R'),
  violas: sequence(m('E4+A4:3 r:13 |'), slice(m(ANSWER_1), 16, 128)),
  cellos: sequence(m('A2+E3:3 r:13 |'), slice(octave(m(ANSWER_1), -1), 16, 128)),
  innerStrings: refrainHarmony(CADENCE_1),
  piano: stack(leftHand(BASS_1), comp(refrainHarmony(CADENCE_1), 'S M S M S M S M'), m('A1+A2+E3+A3+C4+E4:4 r:12 | R R R R R R R')),
  pizz: comp(refrainHarmony(CADENCE_1), 'S O S O S O S O'),
  bass: stack(staccato(BASS_1, 0.85), m('A1:6 r:10 | R R R R R R R')),
  pad: refrainHarmony(CADENCE_1),
  pluck: arp(refrainHarmony(CADENCE_1)),
  kick: kick([SINCOPA, 8]),
  clap: hits(['X...X.......X...', 1], [BACKBEAT, 6], ['....X.......X.xX', 1]),
  hat: hits([HATS, 8]),
  openHat: hits([OPEN, 8]),
  shaker: hits([SHAKER, 8]),
  crash: hits([DOWNBEAT, 1], [NONE, 3], [DOWNBEAT, 1], [NONE, 3]),
  impact: hits([DOWNBEAT, 1], [NONE, 7]),
});

/** The second time, fortissimo: the violins take up the tune in octaves under the solo violin, the cellos drive the last bars in quarters */
const finale2 = passage(FF, {
  // A little under its own level, so the section is heard with it as players rather than swallowed by it
  violin: louder(sing(octave(TUNE_2, 1)), 0.85),
  violins: sing(inOctaves(TUNE_2)),
  violas: m(ANSWER_2),
  cellos: m('A2:4 r:12 | r:4 G3:4 G3:4 F3:2 E3:2 | F3:4 F3:4 r:8 | r:4 E3:4 E3:4 D3:2 C3:2 | D3:4 D3:4 r:8 | C3:4 E3:4 A3:4 C4:4 | B3:4 A3:4 G#3:4 B3:4 |'),
  innerStrings: refrainHarmony(CADENCE_2),
  piano: stack(leftHand(BASS_2), comp(refrainHarmony(CADENCE_2), 'S M S M S M M')),
  pizz: comp(refrainHarmony(CADENCE_2), 'S O S O S O O'),
  bass: staccato(BASS_2, 0.85),
  pad: refrainHarmony(CADENCE_2),
  pluck: arp(refrainHarmony(CADENCE_2)),
  kick: kick([SINCOPA, 6], [SINCOPA_FILL, 1]),
  clap: hits([BACKBEAT, 6], ['....X...........', 1]),
  snare: hits([NONE, 6], [FILL, 1]),
  hat: hits([HATS, 7]),
  openHat: hits([OPEN, 6], [NONE, 1]),
  shaker: hits([SHAKER, 7]),
  crash: hits([DOWNBEAT, 1], [NONE, 3], [DOWNBEAT, 1], [NONE, 2]),
});

// ───────────────────────── The close ─────────────────────────

/**
 * No last hits: the final bar of the refrain broadens (the tempo eases to 92), and the tune lands on A with the whole orchestra on A
 * minor, the kit hitting it once; then the chord thins out from the top down, the violins first, then the solo violin, the cellos and
 * the strings, and the piano's and the bass's low A ring on last into the room
 */
const close = passage(FF, {
  violin: m('A5:20 r:12'),
  violins: m('A4+A5:16 r:16'),
  violas: m('E4+C5:16 r:16'),
  cellos: m('A2+E3:24 r:8'),
  innerStrings: m(`${V.Am}:24 r:8`),
  piano: m('A1+A2+E3+A3+C4+E4+A4:32'),
  pizz: m('A2+E3+A3+C4:2 r:30'),
  bass: m('A1:28 r:4'),
  pad: m(`${V.Am}:20 r:12`),
  kick: kick([DOWNBEAT, 1], [NONE, 1]),
  clap: hits([DOWNBEAT, 1], [NONE, 1]),
  crash: hits([DOWNBEAT, 1], [NONE, 1]),
  impact: hits([DOWNBEAT, 1], [NONE, 1]),
});

const score: Passage[] = [intro, refrain, strain, rise, finale1, finale2, close];

const play = (player: Player): Part => sequence(...score.map((p) => p[player]));

/** A filter sweep as [bar, Hz] points, bars counted from 1 (8.75 is the last beat of bar 8) */
const sweep = (...points: [number, number][]): Sweep => Object.fromEntries(points.map(([bar, hz]) => [(bar - 1) * 16, hz]));
/** The marcato opens through the intro, is muffled again for the cello's strain (bars 17-24) and opens through the build (25-32) */
const FILTER = sweep([1, 500], [8.75, 14000], [16.9375, 14000], [17, 1800], [25, 1800], [32.75, 14000]);

export default defineSong({
  title: 'Por una Cabeza (Electro Tango)',
  description: 'Gardel’s refrain as electro tango: a solo violin and strings over a tuned kick on tango’s 3-3-2, a new strain in A minor for a solo cello as the breakdown, a build, a dead stop, and the last refrains in octaves.',
  bpm: 116,
  // The last bar of the refrain broadens into the final chord
  tempo: [{ bar: 47, bpm: 92, over: 1 }],
  // A beat of nothing before the last refrains
  silences: [{ bar: 32.75, beats: 1 }],
  loop: false,
  reverb: { size: 1.6, damp: 0.5, preDelay: 0.02, mix: 0.75 },
  tracks: [
    { name: 'Solo violin', instrument: 'violin', part: play('violin'), gain: 3.8, pan: -0.05, reverb: 0.3 },
    { name: 'Violins', instrument: 'strings', part: play('violins'), gain: 1.1, pan: -0.45, reverb: 0.35 },
    // The same violins, crescendoing through each note into the next strong beat
    { name: 'Violins, swelling', instrument: 'strings', part: play('violinSwells'), gain: 0.5, pan: -0.45, reverb: 0.35, params: { attack: 1, release: 0.15 } },
    { name: 'Violas', instrument: 'strings', part: play('violas'), gain: 0.5, pan: 0.1, reverb: 0.3 },
    { name: 'Inner strings', instrument: 'strPad', part: play('innerStrings'), gain: 0.35, pan: -0.15, reverb: 0.35 },
    { name: 'Solo cello', instrument: 'cello', part: play('cello'), gain: 3, pan: 0.1, reverb: 0.35 },
    { name: 'Cellos', instrument: 'celli', part: play('cellos'), gain: 1.5, pan: 0.35, reverb: 0.3 },
    { name: 'Strings, pizzicato', instrument: 'pizz', part: play('pizz'), gain: 0.55, pan: -0.3, lowpass: FILTER },
    { name: 'Piano', instrument: 'piano', part: play('piano'), gain: 0.33, pan: 0.35, reverb: 0.2, lowpass: FILTER },
    // Where the double basses were: the same line on a synth, dry and centred
    { name: 'Synth bass', instrument: 'synthBass', part: play('bass'), gain: 0.7, reverb: 0 },
    { name: 'Pad', instrument: 'darkPad', part: play('pad'), gain: 0.3, reverb: 0.5, params: { attack: 0.8, release: 1 }, lowpass: FILTER, duck: { by: 'Kick', depth: 0.5 } },
    { name: 'Pluck', instrument: 'pluck', part: play('pluck'), gain: 0.25, pan: 0.25, reverb: 0.3 },
    { name: 'Kick', instrument: 'bigKick', part: play('kick'), gain: 1.6, reverb: 0 },
    { name: 'Clap', instrument: 'clap909', part: play('clap'), gain: 1.15, reverb: 0.2 },
    { name: 'Snare', instrument: 'snare909', part: play('snare'), gain: 0.75, reverb: 0.25 },
    { name: 'Hi-hat', instrument: 'hat909', part: play('hat'), gain: 0.75, pan: -0.15 },
    { name: 'Open hat', instrument: 'ohat909', part: play('openHat'), gain: 0.7, pan: 0.15 },
    { name: 'Shaker', instrument: 'shaker', part: play('shaker'), gain: 0.75, pan: 0.3 },
    { name: 'Crash', instrument: 'crash', part: play('crash'), gain: 0.7, reverb: 0.3 },
    { name: 'Riser', instrument: 'riser', part: play('riser'), gain: 0.7, reverb: 0.3, highpass: 150 },
    { name: 'Impact', instrument: 'impact', part: play('impact'), gain: 1.2, reverb: 0.1 },
  ],
});
