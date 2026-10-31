// Bizet, Carmen: the opening of the Habanera ("L'amour est un oiseau rebelle", Act 1, No. 5), bars 1-27, Allegretto quasi andantino in
// 2/4. Three bars of the cellos' habanera on D; Carmen's first verse in D minor, her line sliding down by semitones over it; and the
// start of the refrain in D major, the chorus taking up her tune while she sings "L'amour!" above it. Where the aria goes on, this
// closes on the dominant's resolution to D with the aria's own last bar (bar 120).
// Notes from the vocal score of the first edition, arranged by Bizet himself (Choudens, Paris 1875, A.C. 3082; the music and the
// edition are public domain), read against Schirmer's vocal score (New York, 1895, also public domain) where the scan is torn or
// unclear. Carmen and the chorus are sung as written (the voices sing vowels, not words; the tenors sound an octave below their
// treble staff); the piano part is scored here for Bizet's orchestra, and which instrument plays which line is this arrangement's.
// Neither edition gives a metronome mark: ♩ = 72 here, broadening into the last bar.

import { defineSong, melody, sequence, transpose, type Part } from 'polyphon';

const PLAYERS = [
  'carmen', 'sopranos', 'tenors', 'chorusBasses',
  'flutes', 'oboes', 'clarinets', 'bassoons', 'horns', 'cornets', 'timpani', 'triangle', 'tambourine',
  'violinsI', 'violinsII', 'violas', 'cellos', 'basses', 'pizzicato', 'pizzBass',
] as const;
type Player = (typeof PLAYERS)[number];
type Passage = Record<Player, Part>;

/** Dynamics, as velocity scales */
const PP = 0.48;
const P = 0.62;
const F = 1.05;

/** Bars of 2/4 */
const m = (source: string) => melody(source, '2/4');
const octave = (part: Part, n: number) => transpose(part, 12 * n);

/** Detached: each note sounds for `k` of its length */
function staccato(part: Part, k = 0.5): Part {
  return { ...part, notes: part.notes.map((n) => ({ ...n, duration: n.duration * k })) };
}

/** The top note of every chord */
function highest(part: Part): Part {
  return { ...part, notes: part.notes.map((n) => ({ ...n, pitches: [Math.max(...n.pitches)] })) };
}

/** Every chord without its top note (single notes are left out) */
function below(part: Part): Part {
  const notes = part.notes.filter((n) => n.pitches.length > 1).map((n) => ({ ...n, pitches: n.pitches.filter((p) => p !== Math.max(...n.pitches)) }));
  return { ...part, notes };
}

/** Only the notes that start on a bar line */
function downbeats(part: Part): Part {
  return { ...part, notes: part.notes.filter((n) => n.time % 8 === 0) };
}

/**
 * A passage for the whole company at one dynamic (or a hairpin from one to another): the players it leaves out rest.
 * Every part in it must last as long as the others.
 */
function passage(dynamic: number | [number, number], players: Partial<Passage>): Passage {
  const entries = Object.entries(players) as [Player, Part][];
  const length = entries[0][1].duration;
  for (const [name, part] of entries) if (Math.abs(part.duration - length) > 1e-6) throw new Error(`${name} plays ${part.duration} steps of ${length}`);
  const [from, to] = typeof dynamic === 'number' ? [dynamic, dynamic] : dynamic;
  const level = (part: Part): Part => ({
    ...part,
    notes: part.notes.map((n) => ({ ...n, velocity: Math.min(1, n.velocity * (from + ((to - from) * n.time) / length)) })),
  });
  return Object.fromEntries(PLAYERS.map((p) => [p, players[p] ? level(players[p]) : { notes: [], duration: length }])) as Passage;
}

/** The habanera in the cellos, one bar on each harmony over the D the aria stands on: the D on its own, the A slurred up to the chord */
const HABANERA = {
  dm: 'D2:2 r:1 A2:1 F3:2 A2 |',
  gm: 'D2:2 r:1 Bb2:1 G3:2 Bb2 |',
  a7: 'D2:2 r:1 A2:1 G3:2 A2 |',
  d: 'D2:2 r:1 A2:1 F#3:2 A2 |',
  em: 'D2:2 r:1 B2:1 G3:2 B2 |',
};
const habanera = (...harmonies: (keyof typeof HABANERA)[]) => m(harmonies.map((h) => HABANERA[h]).join(' '));

// ───────────────────────── Introduction (bars 1-3) ─────────────────────────

const intro = (() => {
  const cellos = habanera('dm', 'dm', 'dm');
  return passage(PP, { cellos: staccato(cellos, 0.7), pizzBass: octave(downbeats(cellos), 1) });
})();

// ───────────────────────── The verse, D minor (bars 4-19) ─────────────────────────

/** Bars 5, 9, 13 and 17: "L'amour est un oiseau re-" */
const descent = 'C5:4/3 C5 C5 B4:2 Bb4 |';
/** Bars 7 and 15: "-peut ap-pri-voi-" */
const turnF = 'F4:2/3 G4 F4 E4:1 F4 G4:2 F4 |';
/** Bars 10 and 18: "-pel-le, S'il lui con-" */
const repeated = 'A4:1 A4 r A4 G4:2 F4 |';
/** Bars 11 and 19: "-vient de re-fu-" */
const turnE = 'E4:2/3 F4 E4 D4:1 E4 F4:2 E4 |';

/** The chords off the habanera, their top line falling by semitones with Carmen's (bars 5-11, and again 13-19) */
const chords = `
  D4+F4+C5:2 r:2 D4+F4+B4:2 D4+F4+Bb4 | D4+F4+A4:2 r:2 A3+D4+G#4:2 A3+D4+G4 | A3+D4+F4:2 r:2 A3+D4+G4:2 A3+D4+F4 |
  Bb3+D4+E4:2 r:2 D4+E4+D5:2 D4+E4+C#5 | D4+E4+C5:2 r:2 D4+E4+B4:2 D4+E4+Bb4 | D4+E4+A4:2 r:2 Bb3+D4+G4:2 Bb3+D4+F4 |
  G3+C#4+E4:2 r:2 C#4+F4:2 G3+C#4+E4 |`;

const verse = (() => {
  // The port de voix in bars 12 and 16 slides up the octave
  const carmen = m(`
    r:4 D5:2 C#5 | ${descent} A4:2 A4:1 A4 G#4:2 G4 | ${turnF}
    E4:2 r:2 D5:2 C#5 | ${descent} ${repeated} ${turnE}
    D4:4> D5:2 C#5 | ${descent} A4:1 A4 r A4 G#4:2 G4 | ${turnF}
    E4:4> D5:2 C#5 | ${descent} ${repeated} ${turnE}`);
  const cellos = habanera('dm', 'dm', 'dm', 'dm', 'gm', 'gm', 'gm', 'a7', 'dm', 'dm', 'dm', 'dm', 'gm', 'gm', 'gm', 'a7');
  return passage(P, {
    carmen,
    cellos: staccato(cellos, 0.7),
    pizzBass: octave(downbeats(cellos), 1),
    pizzicato: m(`r:4 D4+F4+D5:2 D4+F4+C#5 | ${chords} F3+A3+D4:2 r:2 D4+F4+D5:2 D4+F4+C#5 | ${chords}`),
  });
})();

// ───────────────────────── The refrain begins, D major (bars 20-27) ─────────────────────────

/** "L'amour!": Carmen above the chorus, which sings her tune in the major; the right hand doubles the sopranos an octave up */
const refrain = (() => {
  const carmen = m('D4:6 r:2 | r:4 F#4:4 | A4:6 r:2 | r:4 D5:4 | B4:6 r:2 | r:4 E4:4 | E5:6 r:2 | r:4 A4:4 |');
  const sopranos = m(`
    r:4 D5:2 C#5 | C5:4/3 C5 C5 B4:2 Bb4 | A4:2 A4:1 A4 G#4:2 G4 | F#4:2 E4:1 F#4 G4:2 F#4 |
    E4:2 r:2 D5:2 C#5 | C5:4/3 C5 C5 B4:2 Bb4 | A4:2 A4:1 A4 G4:2 F#4 | E4:2 D4:1 E4 F#4:2 E4 |`);
  // As they sound, an octave below their treble staff
  const tenors = m(`
    r:4 D4+F#4:2 D4+F#4 | D4+F#4:4/3 D4+F#4 D4+F#4 D4+F#4:2 D4+F#4 | D4+F#4:2 D4+F#4:1 D4+F#4 A3+D4:2 A3+D4 | A3+D4:2 A3+D4 A3+D4 A3+D4 |
    G3+B3:2 r:2 E4+G4:2 E4+G4 | E4+G4:4/3 E4+G4 E4+G4 E4+G4:2 E4+G4 | B3+E4:2 B3+E4:1 B3+E4 B3+D4:2 G3+B3 | G3+C#4:2 G3+A3 G3+A3 G3+C#4 |`);
  /** The right hand: the verse's last chord, then the tune in octaves over the chords */
  const right = m(`
    F3+A3+D4:2 r:2 D5+F#5+D6:2 D5+F#5+C#6 | D5+F#5+C6:4/3 C6 C6 D5+F#5+B5:2 D5+F#5+Bb5 |
    D5+F#5+A5:2 r:1 A5:1 A4+D5+G#5:2 A4+D5+G5 | A4+D5+F#5:2/3 G5 F#5 E5:1 F#5 A4+D5+G5:2 A4+D5+F#5 |
    G4+B4+D5+E5:2 r:2 D5+E5+D6:2 D5+E5+C#6 | D5+E5+C6:4/3 C6 C6 D5+E5+B5:2 D5+E5+A#5 |
    D5+E5+A5:2 r:1 A5:1 B4+D5+G5:2 B4+D5+F#5 | G4+C#5+E5:2/3 F#5 E5 D5:1 E5 G4+C#5+F#5:2 G4+C#5+E5 |`);
  const tune = staccato(highest(right), 0.6);
  const cellos = habanera('d', 'd', 'd', 'd', 'em', 'em', 'em', 'a7');
  return passage(P, {
    carmen,
    sopranos,
    tenors,
    flutes: tune,
    clarinets: staccato(below(right), 0.6),
    // The habanera rhythm, lightly
    tambourine: m('(?C4:3 ?C4:1 ?C4:2 ?C4:2 |)*8'),
    violinsI: tune,
    cellos: staccato(cellos, 0.7),
    pizzBass: octave(downbeats(cellos), 1),
    pizzicato: right,
  });
})();

// ───────────────────────── The close: the aria's last bar ─────────────────────────

/** "-mour!" on D, the chorus and the full orchestra under her, the cornets joining for the last chord only */
const close = (() => {
  const right = m('D4+F#4+A4+D5:2 r:1 A5:1 D5+A5+D6:2 r:2 |');
  const left = m('D3+A3:2 r:1 A2:1 D2+D3:2 r:2 |');
  return passage(F, {
    carmen: m('D5:6 r:2 |'),
    sopranos: m('F#4+D5:6 r:2 |'),
    tenors: m('D4:6 r:2 |'),
    chorusBasses: m('D3+A3:6 r:2 |'),
    flutes: highest(right),
    oboes: highest(right),
    clarinets: below(right),
    bassoons: left,
    horns: m('D4+F#4+A4:2 r:2 D4+F#4+A4+D5:2 r:2 |'),
    cornets: m('A4+D5:2 r:2 D5+A5:2 r:2 |'),
    timpani: m('D2:2 r:1 A2:1 D2:2 r:2 |'),
    triangle: m('C4:2 r:2 !C4:2 r:2 |'),
    tambourine: m('!C4:2 r:2 !C4:2 r:2 |'),
    violinsI: highest(right),
    violinsII: below(right),
    violas: octave(below(right), -1),
    cellos: left,
    basses: m('D3:2 r:2 D3:2 r:2 |'),
  });
})();

const score: Passage[] = [intro, verse, refrain, close];

const play = (player: Player): Part => sequence(...score.map((p) => p[player]));

export default defineSong({
  title: 'Carmen: Habanera',
  description: 'Bizet, the opening of Carmen’s entrance aria “L’amour est un oiseau rebelle”: a mezzo-soprano over the cellos’ habanera in D minor, then the chorus in D major.',
  bpm: 72,
  // Broadening into the last bar, which is held
  tempo: [
    { bar: 27, bpm: 62, over: 1 },
    { bar: 28, bpm: 54 },
  ],
  meter: '2/4',
  loop: false,
  reverb: { size: 2.4, damp: 0.5, preDelay: 0.025, mix: 0.85 },
  tracks: [
    { name: 'Carmen', instrument: 'soprano', part: play('carmen'), gain: 1.9, reverb: 0.3, params: { attack: 0.04, release: 0.35 } },
    { name: 'Sopranos', instrument: 'choirO', part: play('sopranos'), gain: 0.6, pan: -0.25, params: { attack: 0.06 } },
    { name: 'Tenors', instrument: 'menChoir', part: play('tenors'), gain: 0.48, pan: 0.2, params: { attack: 0.06 } },
    { name: 'Basses', instrument: 'menChoir', part: play('chorusBasses'), gain: 0.5, pan: 0.35 },
    { name: 'Flutes', instrument: 'flute', part: play('flutes'), gain: 0.3, pan: -0.15 },
    { name: 'Oboes', instrument: 'oboe', part: play('oboes'), gain: 0.35, pan: 0.1 },
    { name: 'Clarinets', instrument: 'clarinet', part: play('clarinets'), gain: 0.4, pan: -0.2 },
    { name: 'Bassoons', instrument: 'bassoon', part: play('bassoons'), gain: 0.45, pan: 0.2 },
    { name: 'Horns', instrument: 'horns', part: play('horns'), gain: 0.35, pan: -0.35 },
    { name: 'Cornets', instrument: 'trumpets', part: play('cornets'), gain: 0.3, pan: 0.3 },
    { name: 'Timpani', instrument: 'timpani', part: play('timpani'), gain: 0.55, reverb: 0.35 },
    { name: 'Triangle', instrument: 'triangle', part: play('triangle'), gain: 0.3, pan: 0.25 },
    { name: 'Tambourine', instrument: 'tamb', part: play('tambourine'), gain: 0.3, pan: -0.3 },
    { name: 'Violins I', instrument: 'strings', part: play('violinsI'), gain: 0.45, pan: -0.5 },
    { name: 'Violins II', instrument: 'strings', part: play('violinsII'), gain: 0.5, pan: -0.25 },
    { name: 'Violas', instrument: 'strings', part: play('violas'), gain: 0.5, pan: 0.2 },
    { name: 'Cellos', instrument: 'celli', part: play('cellos'), gain: 1, pan: 0.35 },
    // The double basses sound an octave below where they are written, plucked or bowed
    { name: 'Double basses', instrument: 'contrabass', part: play('basses'), gain: 0.7, pan: 0.5, transpose: -12 },
    { name: 'Strings, pizzicato', instrument: 'pizz', part: play('pizzicato'), gain: 0.55, pan: -0.1 },
    { name: 'Basses, pizzicato', instrument: 'pizzBass', part: play('pizzBass'), gain: 0.7, pan: 0.45, transpose: -12 },
  ],
});
