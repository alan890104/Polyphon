// Bizet, Carmen: the Prelude to Act 1, complete. Allegro giocoso in A major: the bullfighters' procession from Act 4 (played twice),
// an episode in F-sharp minor, the procession again, the Toreador's song in F major (quietly, then by the full orchestra), the
// procession a last time; then a held silence, and Andante moderato in 3/4 the fate motif in the cellos under tremolo strings, rising
// to a diminished-seventh chord.
// Notes from the piano reduction in the Mutopia Project edition (Schirmer, 1895; the music is public domain, the edition CC BY-SA 2.5),
// scored here for Bizet's orchestra: which instrument plays which line is this arrangement's. Allegro at ♩ = 116 (the edition's tempo),
// Andante at 66.

import { defineSong, melody, scaleVelocity, sequence, stack, transpose, type Part } from 'polyphon';

const PLAYERS = [
  'flutes', 'oboes', 'clarinets', 'bassoons', 'horns', 'trumpets', 'trombones', 'timpani', 'triangle', 'cymbals', 'bassDrum',
  'violinsI', 'violinsII', 'violas', 'cellos', 'basses', 'pizzicato', 'pizzBass',
] as const;
type Player = (typeof PLAYERS)[number];
type Passage = Record<Player, Part>;

/** Dynamics, as velocity scales */
const PP = 0.48;
const P = 0.62;
const F = 1.05;
const FF = 1.25;

/** Bars of the Allegro, in 2/4 */
const m = (source: string) => melody(source, '2/4');
/** Bars of the Andante, in 3/4 */
const m3 = (source: string) => melody(source, '3/4');
const octave = (part: Part, n: number) => transpose(part, 12 * n);

/** Detached: each note sounds for `k` of its length */
function staccato(part: Part, k = 0.5): Part {
  return { ...part, notes: part.notes.map((n) => ({ ...n, duration: n.duration * k })) };
}

/** Bowed tremolo: notes longer than an eighth are played as repeated thirty-seconds */
function tremolo(part: Part): Part {
  const notes = part.notes.flatMap((n) =>
    n.duration > 2 ? Array.from({ length: Math.round(n.duration * 2) }, (_, i) => ({ ...n, time: n.time + i / 2, duration: 0.5 })) : [n],
  );
  return { ...part, notes };
}

/** A trill through a 2/4 bar: the note and the one above in thirty-seconds, closing on the note below and the note */
const trill = (note: string, above: string, below: string) => `(${note}:1/2 ${above})*7 ${below} ${note}`;

/** Hits on both beats of every bar, the first stronger (no bar lines: percussion parts are written as one run) */
const beats = (bars: number) => m(`(!C4:4 C4:4)*${bars}`);

/**
 * A passage for the whole orchestra at one dynamic (or a hairpin from one to another): the players it leaves out rest.
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

// ───────────────────────── The procession (Allegro giocoso, A major) ─────────────────────────

const phraseA = `A5:2 A5:1 A5 A5 E5 D5 E5 | A5:2 A5:1 A5 A5 B5 C#6 B5 | A5:2 A5:1 A5 B5 A5 G#5 A5 | ${trill('B5', 'C#6', 'A#5')} |`;
const phraseD = `D6:2 D6:1 D6 D6 A5 G5 A5 | D6:2 D6:1 D6 D6 E6 F#6 E6 | D6:2 D6:1 C#6 B5:2 B5:1 A5 | ${trill('G#5', 'A5', 'F#5')} |`;
const inC = 'C6+E6:2 C6+E6:1 C6+E6 C6+E6 G5+D6 E5+C6 G5+D6 |';
/** Bars 1-14 of the tune: in A, in D, in A again, and the turn to C */
const tuneOpening = `${phraseA} ${phraseD} ${phraseA} ${inC} ${inC}`;

/** The bass under bars 1-14, on the first and third eighths */
const bassOpening = `
  A2:2 r E3 r | A3 r E3 r | A3 r G#3 r | F#3 r E3 r |
  D3 r A2 r | D3 r A2 r | D3 r G#2 r | C#3 r E3 r |
  A2 r E3 r | A3 r E3 r | A3 r G#3 r | F#3 r E3 r |
  C3 r G2 r | C3 r G2 r |`;

/** The chords off the beat under bars 1-14 */
const offbeatsInA = 'r:2 C#4+E4 r B3+D4+E4 | r C#4+E4 r B3+D4+E4 | r C#4+E4 r A3+C#4+E4 | r A3+B3+D#4 r G#3+B3+E4 |';
const offbeatsOpening = `
  ${offbeatsInA}
  r F#3+A3+D4 r E3+G3+A3+D4 | r F#3+A3+D4 r E3+G3+A3+D4 | r F#3+A3+D4 r F#3+B3+D4 | r E#3+G#3+C#4 r G#3+B3+D4 |
  ${offbeatsInA}
  r G3+C4+E4 r G3+C4+E4 | r G3+C4+E4 r G3+C4+E4 |`;

/** The trumpets' chord on each phrase's downbeat */
const fanfareOpening = 'C#5+E5:2 r:6 | R R R F#5+A5:2 r:6 | R R R C#5+E5:2 r:6 | R R R G5+C6:2 r:6 | G5+C6:2 r:6 |';

const timpaniOpening = `
  A2:2 r E2 r | A2 r E2 r | A2 r:6 | r:4 E2:2 r:2 |
  r:4 A2:2 r:2 | r:4 A2:2 r:2 | R | r:4 E2:2 r:2 |
  A2:2 r E2 r | A2 r E2 r | A2 r:6 | r:4 E2:2 r:2 |
  R R`;

const procession = (() => {
  const tune = staccato(m(`${tuneOpening} E6:2 E5:1 F#5 G#5:2 E5:1 C#6 | G#5+B5:4 E5+A5:2 r:2 |`), 0.6);
  const bass = staccato(m(`${bassOpening} E2:2 E3:1 E3 E3:2 E3:1 E3 | E3:2 E3:1 E3 A2:2 r:2 |`));
  const offbeats = staccato(m(`${offbeatsOpening} r:2 G#3+B3+D4:1 G#3+B3+D4 G#3+B3+D4:2 G#3+B3+D4:1 G#3+B3+D4 | G#3+B3+D4:2 r:2 A3+C#4+E4:2 r:2 |`));
  return passage(FF, {
    flutes: tune,
    oboes: tune,
    clarinets: octave(tune, -1),
    bassoons: bass,
    horns: offbeats,
    trumpets: staccato(m(`${fanfareOpening} E5:2 r:6 | E5+G#5:4 E5+A5:2 r:2 |`)),
    trombones: bass,
    timpani: m(`${timpaniOpening} E2:2 E2:1 E2 E2:2 E2:1 E2 | E2:2 E2:1 E2 A2:2 r:2 |`),
    // A soft roll throughout, and a stroke on the closing chord
    triangle: m('(?C4:1/2)*248 !C4:2 r:2'),
    cymbals: beats(16),
    bassDrum: beats(16),
    violinsI: tune,
    violinsII: octave(tune, -1),
    violas: offbeats,
    cellos: bass,
    basses: bass,
  });
})();

// ───────────────────────── The episode (F-sharp minor) ─────────────────────────

const episode = (() => {
  const top = m(`
    C#5:2 F#5 C#5 B4 | A4:2 G#4:1 F#4 G#4:2 r | F#4:2 G#4 A4 C#5 | E#5:2 D#5:1 E#5 C#5:2 r |
    C#5:2 F#5 C#5 B4 | A4:2 G#4:1 F#4 G#4:2 r | F#4:2 G#4 A4 C#5 | E#5:2 D#5:1 E#5 C#5:2 r |`);
  const below = m(`
    A4:2 C#5 A4 G#4 | F#4:2 E#4:1 D#4 E#4:2 C#4 | D#4:2 E#4 F#4 C#4 | B4:2 A4:1 B4 G#4:2 C#4 |
    A4:2 C#5 A4 G#4 | F#4:2 E#4:1 D#4 E#4:2 C#4 | D#4:2 E#4 F#4 C#4 | G#4:2 G#4:1 G#4 E#4:2 r |`);
  const bass = m(`
    F#2:2 C#3 F#3 G#3 | A3:2 B3:1 C#4 B3:2 C#3 | F#2+A3:2 G#3 F#3 A3 | G#3:2 F#3:1 G#3 E#3:2 C#3 |
    F#2:2 C#3 F#3 G#3 | A3:2 B3:1 C#4 B3:2 C#3 | F#2+A3:2 G#3 F#3 A3 | G#3+B#3:4 C#3+C#4:2 r:2 |`);
  return passage(P, {
    oboes: staccato(top),
    clarinets: staccato(below),
    bassoons: staccato(bass),
    violinsI: staccato(top),
    violinsII: staccato(below),
    cellos: staccato(bass),
  });
})();

/** Forte: the same three-note rhythm in octaves, then answers off the beat */
const outburst = (() => {
  const top = m(`
    D5:1 D5 D5:2 E5:1 E5 E5:2 | F#5:1 F#5 F#5:2 D5:1 D5 D5:2 |
    r:1 C#6 r G#5 r C#6 r D6 | r:1 C#6 r G#5 C#6:2 r:2 |
    D5:1 D5 D5:2 E5:1 E5 E5:2 | F#5:1 F#5 F#5:2 D5:1 D5 D5:2 |`);
  const inner = m(`
    D4:1 D4 D4:2 E4+D5:1 E4+D5 E4+D5:2 | F#4+D5:1 F#4+D5 F#4+D5:2 D4:1 D4 D4:2 |
    r:1 C#5 r G#4 r C#5 r D5 | r:1 C#5 r G#4 C#5:2 r:2 |
    D4:1 D4 D4:2 E4+D5:1 E4+D5 E4+D5:2 | F#4+D5:1 F#4+D5 F#4+D5:2 D4:1 D4 D4:2 |`);
  const bass = m(`
    D3:1 D3 D3:2 E3:1 E3 E3:2 | F#3:1 F#3 F#3:2 D3:1 D3 D3:2 |
    C#3:2 G#2 C#3 D3 | C#3:2 G#2 C#3 r |
    D3:1 D3 D3:2 E3:1 E3 E3:2 | F#3:1 F#3 F#3:2 D3:1 D3 D3:2 |`);
  const cellos = m(`
    D3:1 D3 D3:2 D3+E3:1 D3+E3 D3+E3:2 | D3+F#3:1 D3+F#3 D3+F#3:2 D3:1 D3 D3:2 |
    C#3:2 G#2 C#3 D3 | C#3:2 G#2 C#3 r |
    D3:1 D3 D3:2 D3+E3:1 D3+E3 D3+E3:2 | D3+F#3:1 D3+F#3 D3+F#3:2 D3:1 D3 D3:2 |`);
  const horns = m(`
    D4:1 D4 D4:2 E4:1 E4 E4:2 | F#4:1 F#4 F#4:2 D4:1 D4 D4:2 | R R
    D4:1 D4 D4:2 E4:1 E4 E4:2 | F#4:1 F#4 F#4:2 D4:1 D4 D4:2 |`);
  return passage(F, {
    flutes: staccato(top, 0.6),
    oboes: staccato(top, 0.6),
    clarinets: staccato(inner, 0.6),
    bassoons: staccato(bass, 0.6),
    horns: staccato(horns, 0.6),
    violinsI: staccato(top, 0.6),
    violinsII: staccato(inner, 0.6),
    violas: staccato(octave(bass, 1), 0.6),
    cellos: staccato(cellos, 0.6),
    basses: staccato(bass, 0.6),
  });
})();

/** Pianissimo, tremolo on G-sharp over a bass climbing in octaves, growing to the chord that brings the procession back */
const rise = (() => {
  const climb = m('G#3:2 G#2 A2 A3 | A#3 A#2 B2 B3 | B#3 B#2 C#3 C#4 | D4 D3 D#3 E3 |');
  return passage([PP, FF], {
    bassoons: climb,
    horns: m('G#4:8~ | G#4:8~ | G#4:8~ | G#4:4 r:2 E4+B4+D5:2 |'),
    trumpets: m('R R R r:6 E5+G#5:2 |'),
    trombones: m('R R R r:6 E3+B3+D4:2 |'),
    timpani: m('R R (E2:1/2)*16 | (E2:1/2)*12 E2:2 |'),
    violinsI: tremolo(m('G#5:8 | G#5:8 | G#5:8 | G#5:4 r:2 E5+G#5:2 |')),
    violinsII: tremolo(m('G#4:8 | G#4:8 | G#4:8 | G#4:4 G#4:2 B4+D5:2 |')),
    violas: octave(climb, 1),
    cellos: climb,
    basses: climb,
  });
})();

// ───────────────────────── The Toreador's song (F major) ─────────────────────────

/** Four bars of pizzicato, then the tune in the violins with the cellos an octave below; bars 25-26 hand over to the winds */
const toreador = (() => {
  const tune = m(`
    R R R R
    C5:4 D5:3 C5:1 | A4:4 A4 | A4:3 G4:1 A4:3 Bb4:1 | A4:6 r:2 |
    Bb4:4 G4:3 C5:1 | A4:6 r:2 | F4:4 D4:3 G4:1 | C4:6 r:2 |
    G4:8 | G4:2 D5 C5 Bb4 | A4:2 G4 A4 Bb4 | A4:6 r:2 |
    E4:4 A4 | A4:4 G#4:3 B4:1 | E5:8~ | E5:8~ |
    E5:2 D5:2/3 E5 D5 C5:2 D5 | G4:2 A4 Bb4:4~ | Bb4:2 A4:2/3 Bb4 A4 F4:2 D5 | C5:6 r:2 |
    R R`);
  /** The upper strings' plucked chords */
  const pizzicato = m(`
    A3+C4+F4+A4:2 r A3+C4+F4+A4 r | A3+C4+F4+A4 r A3+C4+F4+A4 r | A3+C4+F4+A4 r A3+C4+F4+A4 r | A3+C4+F4+A4 r A3+C4+F4+A4 r |
    A3+C4+F4+A4 r A3+C4+F4+A4 r | A3+C4+F4 r A3+C4+F4 r | A3+C4+F4 r A3+C4+F4 r | A3+C4+F4 r A3+C4+F4 r |
    Bb3+D4+F4 r Bb3+C4+E4 r | A3+C4+F4 r A3+C4+F4 r | A3+C4 r F3+G3+B3 r | E3+G3 r C3 r |
    D4 r:6 | D4:2 r Bb3+D4 r | A3+D4 r D4 r | A3+D4 r F3+A3+D4 r |
    A3+C4 r E4 r | D4+E4 r B3+D4+E4 r | C#4+E4 r A3+C#4+E4 r | E3+A3+C#4+E4+A4 r C#3+E3+A3+E4+A4 r |
    D3+F3+G3+F4+G4 r F3+G3+F4+G4 r | D3+F3+G3+D4+F4 r D3+F3+G3+D4+F4 r | C4 r:6 | R
    C4:2 r:6 | r:4 Bb3:2 r:2 |`);
  /** The basses' plucked roots (sounding an octave lower) */
  const roots = m(`
    F3:2 r C3 r | F3 r C3 r | F3 r C3 r | F3 r C3 r |
    F3 r C3 r | F3 r C3 r | F3 r C3 r | F3 r C3 r |
    G3 r C3 r | F3 r E3 r | D3 r G2 r | C3 r C3 r |
    Bb3 r D4 r | Bb3 r G3 r | F3 r A3 r | F3 r D3 r |
    E3 r C4 r | B3 r E3 r | A3 r E3 r | C#3 r A2 r |
    Bb2 r D3 r | Bb2 r G2 r | C3:2 r:6 | R
    A3:2 r:6 | r:4 C3:2 r:2 |`);
  return passage(P, {
    oboes: m('R*24 r:2 F4:2/3 G4 F4 C4:2 Bb4 | A4:4 r:4 |'),
    clarinets: m('R*25 r:4 C4+E4:2 r:2 |'),
    bassoons: staccato(m('R*23 r:2 A3:2/3 Bb3 A3 C3+F3:2 Bb3+D4 | R R'), 0.7),
    violinsI: tune,
    cellos: octave(tune, -1),
    pizzicato,
    pizzBass: roots,
  });
})();

/** A scale in tenths, growing into the full orchestra */
const run = (() => {
  const upper = m('C4+F4:2 C4:1 D4 E4 F4 G4 A4 | Bb4:1 C5 D5 E5 F5 G5 F5+A5 G5+Bb5 |');
  const lower = m('F3+A3:2 A3:1 Bb3 C4 D4 E4 F4 | G4:1 A4 Bb4 C5 D5 E5 F5 G5 |');
  return passage([P, FF], {
    oboes: upper,
    clarinets: lower,
    bassoons: octave(lower, -1),
    violinsI: upper,
    violinsII: lower,
    violas: lower,
    cellos: octave(lower, -1),
  });
})();

/** "Toréador, en garde": the refrain, fortissimo */
const refrain = (() => {
  const tune = m(`
    C6:2 r:2 D6:2 r:1 C6:1 | A5:2 r:2 A5:2 r:2 | A5:2 r:1 G5:1 A5:2 r:1 Bb5:1 | A5:6 r:2 |
    Bb5:2 r:2 G5:2 r:1 C6:1 | A5:6 r:2 | F5:2 r:2 D5:2 r:1 G5:1 | C5:6 r:2 |`);
  const chords = m(`
    C5+F5+A5:2 r:2 D5+F5+A5:2 r:2 | A4+C5+F5:2 r:2 A4+C5+F5:2 r:2 | A4+C5+F5:2 r:2 A4+C5+F5:2 r:2 | C5+F5:2 r:2 C5+F5:2 r:2 |
    Bb4+D5+F5:2 r:2 G4+C5+E5:2 r:2 | C5+F5:2 r:2 C5+F5:2 r:2 | F4+A4+C5:2 r:2 D4+F4+B4:2 r:2 | E4+G4:2 r:2 E4+G4:2 r:2 |`);
  const inner = m(`
    A3+C4:2 r F3+A3+C4 r | A3+C4 r F3+A3+C4 r | A3+C4 r F3+A3+C4 r | A3+C4 r F3+A3+C4 r |
    Bb3+D4 r G3+Bb3+C4 r | A3+C4 r F3+A3+C4 r | F3+A3+C4 r B3 r | E3+G3+C4 r r r |`);
  const bass = m(`
    F3:2 r C3 r | F3 r C3 r | F3 r C3 r | F3 r C3 r |
    G3 r C3 r | F3 r E3 r | D3 r G3 r | C3 r C4 r |`);
  return passage(FF, {
    flutes: tune,
    oboes: tune,
    clarinets: octave(tune, -1),
    bassoons: staccato(bass),
    horns: staccato(inner),
    trumpets: octave(tune, -1),
    trombones: staccato(inner),
    timpani: m('F2:2 r C2 r | F2 r C2 r | F2 r C2 r | F2 r C2 r | R F2:2 r:6 | R C2:2 r:6 |'),
    triangle: m('(!C4:4 C4)*8'),
    cymbals: m('(!C4:8)*8'),
    bassDrum: beats(8),
    violinsI: tune,
    violinsII: staccato(chords),
    violas: staccato(octave(chords, -1)),
    cellos: staccato(bass),
    basses: staccato(bass),
  });
})();

/** The tune once more, softly and in octaves */
const espressivo = (() => {
  const tune = m('G5:8 | G5:2 D6 C6 Bb5 | A5:2 G5 A5 Bb5 | A5:6 r:2 | E5:4 A5 | A5:4 G#5:3 B5:1 |');
  return passage(P, {
    clarinets: octave(tune, -1),
    violinsI: tune,
    violinsII: octave(tune, -1),
    cellos: octave(tune, -2),
    pizzicato: m('D4:2 r:6 | D4:2 r Bb3+D4 r | A3+D4 r D4 r | A3+D4 r F3+A3+D4 r | A3+C4 r E4 r | D4+E4 r B3+D4+E4 r |'),
    pizzBass: m('Bb3:2 r D4 r | Bb3 r G3 r | F3 r A3 r | F3 r D3 r | E3 r C4 r | B3 r E3 r |'),
  });
})();

/** Tremolo on E, then turns and runs, growing toward the procession's return */
const swell = (() => {
  const top = sequence(
    tremolo(m('E6:8 | E#6:8 |')),
    m('G#6:1 r:1 F#6:2/3 G#6 F#6 E#6:2 F#6:2 | B5:2 C#6:2 D6:4 | D6:1 r:1 C#6:2/3 D6 C#6 A5:2 F#6:2 | E6:2 C#5:1 C#5 A4:2 F#5:2 |'),
  );
  const below = sequence(
    tremolo(m('E5:8 | E#5:8 |')),
    m('G#5:1 r:1 F#5:2 E#5:2 F#5:2 | B4:2 C#5:2 D5:4 | D5:1 r:1 C#5:2/3 D5 C#5 A4:2 F#5:2 | E5:2 A4+C#5:1 A4+C#5 A4:2 A4+D5:2 |'),
  );
  const bass = m('A3:2 r:2 E3:2 r:2 | C#3:2 r:2 A2:2 r:2 | D3:2 r:2 F#3:2 r:2 | D3:2 r:2 B2:2 r:2 | E2:2 r:6 | r:2 E3:1 E3 E3:2 E3:2 |');
  return passage([PP, F], {
    flutes: m('R R G#6:1 r:1 F#6:2/3 G#6 F#6 E#6:2 F#6:2 | B5:2 C#6:2 D6:4 | D6:1 r:1 C#6:2/3 D6 C#6 A5:2 F#6:2 | E6:2 r:6 |'),
    oboes: octave(m('R R G#6:1 r:1 F#6:2/3 G#6 F#6 E#6:2 F#6:2 | B5:2 C#6:2 D6:4 | D6:1 r:1 C#6:2/3 D6 C#6 A5:2 F#6:2 | E6:2 r:6 |'), -1),
    clarinets: m('R R R R D5:1 r:1 C#5:2/3 D5 C#5 A4:2 F#5:2 | E5:2 A4+C#5:1 A4+C#5 A4:2 A4+D5:2 |'),
    bassoons: staccato(bass, 0.7),
    horns: m('A3+C#4+E4:8 | A3+C#4+E#4:8 | F#3+A3:2 r:2 A#3:2 r:2 | F#3+B3:2 r:2 D3+F#3+B3:2 r:2 | R r:2 A3+C#4:1 A3+C#4 A3+C#4:2 A3+D4:2 |'),
    violinsI: top,
    violinsII: below,
    violas: m('R R F#3+A3:2 r:2 A#3:2 r:2 | F#3+B3:2 r:2 D3+F#3+B3:2 r:2 | R r:2 A3+C#4:1 A3+C#4 A3+C#4:2 A3+D4:2 |'),
    cellos: staccato(bass, 0.7),
    basses: staccato(bass, 0.7),
    pizzicato: m('A3+C#4+E4:2 r:2 A3+C#4+E4:2 r:2 | C#3+E#3+A3:2 r:2 C#3+E#3+A3:2 r:2 | R R R R'),
  });
})();

/** Fortissimo: the last turns before the procession */
const herald = (() => {
  const top = m('E5:2 A5:2/3 B5 A5 E5:2 D6:2 | C#6:2 r:2 B5:2 r:2 |');
  const below = m('A4+C#5:2 A4:2/3 B4 A4 E4:2 D5:2 | C#5:2 r:2 G#4+D5:2 r:2 |');
  const bass = m('E3:2 A3:2/3 B3 A3 E3:2 D4:2 | C#4:2 r:2 E2:2 r:2 |');
  return passage(FF, {
    flutes: top,
    oboes: top,
    clarinets: below,
    bassoons: bass,
    horns: m('A3+C#4:2 r:6 | r:4 G#3+B3:2 r:2 |'),
    trumpets: m('A4+E5:2 r:6 | C#5:2 r:2 E5+G#5:2 r:2 |'),
    trombones: m('E3+A3:2 r:6 | r:4 E3+B3:2 r:2 |'),
    violinsI: top,
    violinsII: below,
    violas: octave(below, -1),
    cellos: bass,
    basses: bass,
  });
})();

/** The procession a last time, ending on A; then a bar of silence, held */
const finale = (() => {
  const procession = staccato(m(`${tuneOpening} (C6+E6:1 G5+D6 E5+C6 G5+D6)*2 | (C6+E6:1 G5+D6 E5+C6 G5+D6)*2 |`), 0.6);
  /** Held on E (the violins in tremolo), the dominant seventh, the last chord */
  const close = m('E6:8 | E6:4 E5:2 D6+E6:2 | A6:2 r:2 A4:2 r:2 | R');
  const tune = sequence(procession, close);
  const bass = staccato(m(`${bassOpening} C3:2 G2+G3 C3+G3 G2+G3 | C3+G3 G2+G3 C3+G3 G2+G3 | E2:2 E3:1 E3 E3:4/3 E3 E3 | E3:4/3 E3 E3 E3:2 E3:2 | A2:2 r:2 A2:2 r:2 | R`));
  const offbeats = staccato(m(`${offbeatsOpening} r:2 G3+C4+E4 r G3+C4+E4 | r G3+C4+E4 r G3+C4+E4 | E4:8 | E4:4 r:2 G#3+B3+D4:2 | A3+C#4+E4:2 r:6 | R`));
  return passage(FF, {
    flutes: tune,
    oboes: tune,
    clarinets: octave(tune, -1),
    bassoons: bass,
    horns: offbeats,
    trumpets: staccato(m(`${fanfareOpening} E5+C6:2 r:6 | E5+C6:2 r:6 | E5:8 | E5:4 r:2 E5+G#5:2 | E5+A5:2 r:6 | R`)),
    trombones: bass,
    timpani: m(`${timpaniOpening} R R (E2:1/2)*16 | (E2:1/2)*8 E2:2 E2:2 | A2:2 r:2 A2:2 r:2 | R`),
    triangle: m('(?C4:1/2)*288 !C4:2 r:6 R'),
    cymbals: m('(!C4:4 C4:4)*16 !C4:8 R !C4:8 R'),
    bassDrum: m('(!C4:4 C4:4)*16 !C4:8 R !C4:4 C4:4 R'),
    violinsI: sequence(procession, tremolo(close)),
    violinsII: octave(sequence(procession, tremolo(close)), -1),
    violas: offbeats,
    cellos: bass,
    basses: bass,
  });
})();

// ───────────────────────── The fate motif (Andante moderato, 3/4) ─────────────────────────

/** The motif, in the cellos (and clarinets and bassoons), bars 1-26 */
const motif = m3(`
  R R
  D4:6 C#4:2 Bb3:2 C#4:2 | A3:2 r:10 |
  A3:6 G#3:2 F3:2 G#3:2 | E3:4 r:8 |
  G3:6 F#3:2 Eb3:2 F#3:2 | D3:4 E3:4 F3:4 | A3:8 G3:4 | G3:4 F3:6 r:2 |
  F4:6 E4:2 Db4:2 E4:2 | C4:4 r:8 |
  C4:6 B3:2 Ab3:2 B3:2 | G3:4 r:8 |
  Bb3:6 A3:2 Gb3:2 A3:2 | F3:4 G3:4 Ab3:4 | C4:8 Bb3:4 | Bb3:4 Ab3:6 r:2 |
  Cb4:6 Ab3:2 G3:2 Ab3:2 | Cb4:4 Bb3:6 r:2 |
  Db4:6 Bb3:2 A3:2 Bb3:2 | Db4:4 C4:6 r:2 |
  Eb4:6 C4:2 B3:2 C4:2 | F#4:6 Eb4:2 D4:2 Eb4:2 |
  A4:8 !A4:4~ | A4:2 !A4:4 !A4:4 A4:2 |`);

/** Under it, the strings' tremolo: the violins I's note, and the two below it (violins II and violas), bars 1-26 */
const high = 'A4:12 | A4 | A4 | A4 | B4 | Bb4 | D5 | D5 | C5 | C5 | B4 | C5 | D5 | E5 | F5 | F5 | Eb5 | Eb5 | D5 | Eb5 | Eb5 | F5 | Eb5 | F#5 | A5 | A5 |';
const middle = 'F4:12 | F4 | F4 | F4 | F4 | G4 | A4 | A4 | Bb4 | A4 | Ab4 | Ab4 | Ab4 | Db5 | C5 | C5 | Db5 | C5 | Cb5 | Cb5:4 Bb4:8 | Db5:12 | Db5:4 C5:8 | A4:12 | C5 | Eb5 | Eb5 |';
const low = 'D4:12 | D4 | F4 | D4 | D4 | D4 | D4 | F4 | E4 | F4 | Ab4 | F4 | F4 | E4 | F4 | Ab4 | G4 | Ab4 | F4 | Eb4 | G4 | F4 | F#4 | A4 | C5 | C5 |';

/** The basses' notes, sounding an octave lower, bars 1-26 */
const ground = m3(`
  R R R r:4 D3:2 r:2 D3:2 r:2 | R r:4 D3:2 r:2 D3:2 r:2 | R
  B2:12 | C3:12 | F2:6 r:6 | R r:4 F3:2 r:2 F3:2 r:2 | R r:4 F3:2 r:2 F3:2 r:2 | R
  D3:12 | Eb3:12 | Ab2:6 r:6 | Ab2:2 r:10 | r:4 G2:2 r:2 G2:2 r:2 | Bb2:2 r:10 | r:4 A2:2 r:2 A2:2 r:2 |
  C3:2 r:10 | Eb3:2 r:10 | F#3:2 r:10 | R`);

/** Bars 1-26 cut into the passages that carry the dynamics: 1-18 fortissimo, 19-22 piano, 23-26 growing */
const BARS: [number, number, number | [number, number]][] = [
  [0, 18, FF],
  [18, 22, P],
  [22, 26, [P, FF]],
];

const tremolos = { high: tremolo(m3(high)), middle: tremolo(m3(middle)), low: tremolo(m3(low)) };

const fate = BARS.map(([from, to, dynamic]) => {
  const bars = (part: Part) => slicedBars(part, from, to);
  const brass = (source: string) => bars(m3(`R*24 ${source}`));
  return passage(dynamic, {
    flutes: brass('Eb5+A5:12 | Eb5+A5:12 |'),
    oboes: brass('C5+Eb5:12 | C5+Eb5:12 |'),
    clarinets: bars(motif),
    bassoons: bars(motif),
    horns: bars(scaleVelocity(stack(m3(middle), m3(low)), 0.55)),
    trumpets: brass('A4:8 !A4:4~ | A4:2 !A4:4 !A4:4 A4:2 |'),
    trombones: brass('A2+C3+Eb3+F#3:12 | A2+C3+Eb3:12 |'),
    timpani: bars(m3('R*3 r:4 D2:2 r:2 D2:2 r:2 | R r:4 D2:2 r:2 D2:2 r:2 | R*18 (A2:1/2)*24 | (A2:1/2)*24 |')),
    violinsI: bars(tremolos.high),
    violinsII: bars(tremolos.middle),
    violas: bars(tremolos.low),
    cellos: bars(motif),
    basses: bars(ground),
  });
});

/** The last bar: a diminished-seventh chord, fortissimo for everyone, and silence */
const lastChord = passage(1.4, {
  flutes: m3('E5+Bb5:2 r:10 |'),
  oboes: m3('C#5+E5:2 r:10 |'),
  clarinets: m3('Bb4+C#5:2 r:10 |'),
  bassoons: m3('G2+Bb2:2 r:10 |'),
  horns: m3('Bb3+C#4+E4:2 r:10 |'),
  trumpets: m3('C#5+E5:2 r:10 |'),
  trombones: m3('G2+Bb2+E3:2 r:10 |'),
  violinsI: m3('Bb5:2 r:10 |'),
  violinsII: m3('E5:2 r:10 |'),
  violas: m3('Bb4+C#5:2 r:10 |'),
  cellos: m3('G2+G3:2 r:10 |'),
  basses: m3('G2:2 r:10 |'),
});

/** Bars [from, to) of a 3/4 part */
function slicedBars(part: Part, from: number, to: number): Part {
  const [start, end] = [from * 12, to * 12];
  const notes = part.notes.filter((n) => n.time >= start - 1e-6 && n.time < end - 1e-6).map((n) => ({ ...n, time: n.time - start, duration: Math.min(n.duration, end - n.time) }));
  return { notes, duration: end - start };
}

const score: Passage[] = [
  procession, procession, // bars 1-32, the repeat written out
  episode, outburst, rise, // 33-50
  procession, // 51-66
  toreador, run, refrain, // 67-102
  espressivo, swell, herald, // 103-116
  finale, // 117-136
  ...fate, lastChord, // the Andante
];

const play = (player: Player): Part => sequence(...score.map((p) => p[player]));

export default defineSong({
  title: 'Carmen: Prelude',
  description: 'Bizet, the Prelude to Act 1 for full orchestra: the procession, the Toreador’s song, and the fate motif under tremolo strings.',
  bpm: 116,
  // The last bar of the Allegro is a held silence; the Andante takes its tempo from there
  tempo: [{ bar: 136, bpm: 66 }],
  meter: '2/4',
  loop: false,
  reverb: { size: 2.6, damp: 0.45, preDelay: 0.025, mix: 0.9 },
  tracks: [
    { name: 'Flutes', instrument: 'flute', part: play('flutes'), gain: 0.45, pan: -0.15 },
    { name: 'Oboes', instrument: 'oboe', part: play('oboes'), gain: 0.4, pan: 0.1 },
    { name: 'Clarinets', instrument: 'clarinet', part: play('clarinets'), gain: 0.5, pan: -0.2 },
    { name: 'Bassoons', instrument: 'bassoon', part: play('bassoons'), gain: 0.5, pan: 0.2 },
    { name: 'Horns', instrument: 'horns', part: play('horns'), gain: 0.5, pan: -0.35 },
    { name: 'Trumpets', instrument: 'trumpets', part: play('trumpets'), gain: 0.4, pan: 0.3 },
    { name: 'Trombones', instrument: 'trombone', part: play('trombones'), gain: 0.4, pan: 0.4 },
    { name: 'Timpani', instrument: 'timpani', part: play('timpani'), gain: 0.8, reverb: 0.35 },
    { name: 'Triangle', instrument: 'triangle', part: play('triangle'), gain: 0.35, pan: 0.25 },
    { name: 'Cymbals', instrument: 'crash', part: play('cymbals'), gain: 0.35, pan: 0.15 },
    { name: 'Bass drum', instrument: 'boom', part: play('bassDrum'), gain: 0.45, pan: 0.1 },
    { name: 'Violins I', instrument: 'strings', part: play('violinsI'), gain: 0.85, pan: -0.5 },
    { name: 'Violins II', instrument: 'strings', part: play('violinsII'), gain: 0.75, pan: -0.25 },
    { name: 'Violas', instrument: 'strings', part: play('violas'), gain: 0.65, pan: 0.2 },
    { name: 'Cellos', instrument: 'celli', part: play('cellos'), gain: 0.85, pan: 0.4 },
    // The double basses sound an octave below where they are written, plucked or bowed
    { name: 'Double basses', instrument: 'contrabass', part: play('basses'), gain: 0.8, pan: 0.55, transpose: -12 },
    { name: 'Strings, pizzicato', instrument: 'pizz', part: play('pizzicato'), gain: 0.7, pan: -0.1 },
    { name: 'Basses, pizzicato', instrument: 'pizzBass', part: play('pizzBass'), gain: 0.8, pan: 0.45, transpose: -12 },
  ],
});
