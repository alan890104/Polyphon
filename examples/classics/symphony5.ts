// Beethoven, Symphony No. 5 in C minor, Op. 67, first movement: the exposition (bars 1-124).
// The full orchestra, each part as written: flutes, oboes, clarinets and bassoons in pairs, horns, trumpets, timpani and strings.
// Notes checked against the Mutopia Project edition (the music and the edition are both public domain). The edition gives no
// dynamics, so every note plays at one level. ~ ties a note across the bar line; Violins I divide for one chord in bar 21, written as a second voice.

import { defineSong, melody, stack } from 'polyphon';

/** A part from one or more voices, in 2/4 */
const part = (...voices: string[]) => stack(...voices.map((v) => melody(v, '2/4')));

const flutes = part(
  `
  R*16
  R r:2 D6+G6*2 D6+F6 | C6+Eb6:4 r | C6 r |
  B5+G6 r | r:2 Ab5*3 | F5:8~ | F5 |
  R*12
  R R C6:4 r | C6 r |
  C6 r | C6 r | B5+D6 r | C6+Eb6:8~ |
  C6+Eb6~ | C6+Eb6~ | C6+Eb6 | D6+F6~ |
  D6+F6~ | D6+F6~ | D6+F6:4 C6+Eb6 | C6+Eb6:8~ |
  C6+Eb6~ | C6+Eb6~ | C6+Eb6 | A5+F#6:4 r |
  R Bb5 r | R R
  R*8
  R R Bb5 Eb6 | D6 Eb6 |
  F6 C6 | C6 Bb5 | R R
  R*12
  R R Eb6 F6 | F#6 F6 |
  F#6 Ab6 | Bb5+F6:8~ | Bb5+F6:4*2 | Bb5+G6 r |
  Bb5+F6 r | Bb5+Eb6 r | C6+Eb6 r | Bb5+Eb6 r |
  Bb5+D6 r | Bb5+F6:8~ | Bb5+F6 | Bb5+G6:4*2 |
  r Bb5+D6 | r Bb5+Eb6 | r Ab5+Eb6 | r Bb5+Eb6 |
  r Bb5+D6 | Bb5+Eb6:2 G6*3 | Eb6 Bb5*3 | G5 Eb5*3 |
  Bb4:8~ | Bb4:2 G6*3 | Eb6 Bb5*3 | G5 Eb5*3 |
  Bb4:8~ | Bb4:4 r | r:2 Bb5*3 | Bb5:4 r |
  r:2 F5+D6*3 | G5+Eb6:4 r | R R
  `,
);

const oboes = part(
  `
  R*16
  R r:2 D5+G5*2 D5+F5 | C5+Eb5:4 r | C5+F#5 r |
  B4+G5 r | r:2 Ab5*3 | F5:8~ | F5 |
  R*4
  R R R r:2 F5*3 |
  Eb5:4 r | R R Eb5+G5:8~ |
  Eb5+G5:4 r | F5+Ab5 r | E5+G5 r | F5+Ab5 r |
  G5+Bb5 r | F5+Ab5 r | F5+Ab5 r | Eb5+G5:8~ |
  Eb5+G5~ | Eb5+G5~ | Eb5+G5 | F5+G5~ |
  F5+G5~ | F5+G5~ | F5+G5:4 Eb5+G5 | Eb5+F#5:8~ |
  Eb5+F#5~ | Eb5+F#5~ | Eb5+F#5 | Eb5+F#5:4 r |
  R Bb4+F5 r | R R
  R*20
  R R R C6:8~ |
  C6 | Bb5~ | Bb5 | A5~ |
  A5~ | A5~ | A5~ | A5:4*2 |
  A5*2 | F5+Ab5:8~ | F5+Ab5:4*2 | Eb5+G5 r |
  Ab5 r | Eb5+Bb5 r | Eb5+C6 r | Eb5+G5 r |
  D5+F5 r | F5+Ab5:8~ | F5+Ab5 | Eb5+G5:4*2 |
  r D5+F5 | r Eb5+G5 | r Eb5+F5 | r Eb5+G5 |
  r D5+F5 | Eb5+G5:2 G5*3 | Eb5 Bb5*3 | G5 Eb5*3 |
  Bb4:8~ | Bb4:2 G5*3 | Eb5 Bb5*3 | G5 Eb5*3 |
  Bb4:8~ | Bb4:4 r | r:2 D5+F5*3 | Eb5+G5:4 r |
  r:2 F5+Bb5*3 | Eb5+G5:4 r | R R
  `,
);

const clarinets = part(
  `
  r:2 G4*3 | Eb4:8 | r:2 F4*3 | D4:8~ |
  D4 | R R R
  R*8
  R r:2 G3+B3 B3+D4 D4+G4 | Eb4+G4:4 r | C4+F#4 r |
  B3+D4 r | r:2 Ab4*3 | F4:8~ | F4 |
  R*4
  R R R r:2 D5*3 |
  C5:4 r | R R R
  R F4+Ab4 r | E4+G4 r | F4+Ab4 r |
  G4+Bb4 r | F4+Ab4 r | D4+F4 r | Eb4+G4:8~ |
  Eb4+G4~ | Eb4+G4~ | Eb4+G4 | D4+F4~ |
  D4+F4~ | D4+F4~ | D4+F4:4 C4+Eb4 | F#4+Eb5:8~ |
  F#4+Eb5~ | F#4+Eb5~ | F#4+Eb5 | F#4+Eb5:4 r |
  R Bb4 r | R R
  R*4
  R R Bb4 Eb5 | D5 Eb5 |
  F5 C5 | C5 Bb4 | R R
  R*8
  R R C5+Eb5:8~ | C5+Eb5~ |
  C5+Eb5 | Bb4+Eb5~ | Bb4+Eb5 | A4+Eb5~ |
  A4+Eb5~ | A4+Eb5~ | A4+Eb5~ | A4+Eb5:4*2 |
  A4+Eb5*2 | Ab4+Bb4:8~ | Ab4+Bb4:4 F4+Bb4 | G4+Bb4 r |
  Ab4+Bb4 r | G4+Bb4 r | F4+C5 r | G4+Bb4 r |
  F4+Bb4:2 A4+A5 Bb4+Bb5 A4+A5 | Bb4+Bb5 A4+A5 Bb4+Bb5 A4+A5 | Bb4+Bb5 C5+C6 Bb4+Bb5 Ab4+Ab5 | G4+G5:4*2 |
  r F4+D5 | r G4+Eb5 | r F4+Ab4 | r Eb4+G4 |
  r F4+D5 | G4+Eb5:2 G5*3 | D5 Bb4+Bb5*3 | G4+G5 Eb4+Eb5*3 |
  Bb3+Bb4:8~ | Bb3+Bb4:2 G5*3 | D5 Bb4+Bb5*3 | G4+G5 Eb4+Eb5*3 |
  Bb3+Bb4:8~ | Bb3+Bb4:4 r | r:2 F4+D5*3 | G4+Eb5:4 r |
  r:2 D5+F5*3 | G4+Eb5:4 r | R R
  `,
);

const bassoons = part(
  `
  R*4
  R R C4:8~ | C4~ |
  C4~ | C4 | B3~ | B3~ |
  B3~ | B3 | C4 | B3 |
  C4 | B3:2*4 | C4:4 r | Ab2 r |
  G2 r | r:2 Ab2*3 | F2:8~ | F2 |
  R*8
  R R R Eb4+G4~ |
  Eb4+G4:4 r | B3 r | C3+Bb3 r | C3+Ab3 r |
  C3+E3 r | C3+F3 r | C3+C4 r | C3+Eb3:8~ |
  C3+Eb3~ | C3+Eb3~ | C3+Eb3 | B2+D3~ |
  B2+D3~ | B2+D3~ | B2+D3:4 C3+Eb3 | Eb3+A3:8~ |
  Eb3+A3~ | Eb3+A3~ | Eb3+A3 | Eb3+A3:4 r |
  R D3+F3 r | R R
  R*4
  R R G3+Bb3:8 | F3+Ab3 |
  Bb2+F3 | Eb3+G3 | G3+Bb3 | F3+Ab3 |
  Bb2+F3 | Eb3+G3 | G3+Bb3 | E3+G3 |
  C3+E3 | F3+Ab3 | Ab3+Db4 | G3+Bb3 |
  Eb3+G3 | Ab3+C4 | Ab2+Ab3 | A2+A3~ |
  A2+A3 | Bb2+Bb3~ | Bb2+Bb3 | B2+B3~ |
  B2+B3 | C3+C4~ | C3+C4~ | C3+C4:4*2 |
  C3+C4*2 | D3+D4:8~ | D3+D4:4 D3+F3 | Eb3+G3 r |
  F3+Ab3 r | G3+Bb3 r | Ab3+C4 r | Bb3 r |
  Bb2 r | F4+Ab4:8~ | F4+Ab4:4 Bb3+F4 | Eb4+G4*2 |
  r Bb3+F4 | r Bb3+Eb4 | r Ab3+C4 | r G3+Bb3 |
  r Bb2+Bb3 | Eb3+Eb4:2 G4*3 | Eb4 Bb3*3 | G3 Eb3*3 |
  Bb2:8~ | Bb2:2 G4*3 | Eb4 Bb3*3 | G3 Eb3*3 |
  Bb2:8~ | Bb2:4 r | r:2 Bb3+D4*3 | Bb3+Eb4:4 r |
  r:2 Bb2*3 | Eb3:4 r | R R
  `,
);

const horns = part(
  `
  R*16
  R r:2 G4*3 | G4:4 r | Eb3+Eb4 r |
  G3+G4 r | r:2 Ab4*3 | F4:8~ | F4 |
  R*4
  R R R r:2 G3+G4*3 |
  G3+G4:4 r | F4+Ab4:8~ | F4+Ab4:4 r | R
  R*4
  R R F4+Ab4 r | Eb4+G4:8~ |
  Eb4+G4~ | Eb4+G4~ | Eb4+G4 | F4+G4~ |
  F4+G4~ | F4+G4~ | F4+G4:4 Eb4+G4 | Eb4+F#4:8~ |
  Eb4+F#4~ | Eb4+F#4~ | Eb4+F#4 | Eb4+F#4:4 r |
  R Bb3+F4 r | r:2 Bb4*3 | Eb4:8 |
  F4 | Bb3~ | Bb3~ | Bb3~ |
  Bb3~ | Bb3~ | Bb3~ | Bb3~ |
  Bb3~ | Bb3~ | Bb3~ | Bb3~ |
  Bb3~ | Bb3 | R R
  R*4
  R R Eb3+Eb4~ | Eb3+Eb4~ |
  Eb3+Eb4~ | Eb3+Eb4~ | Eb3+Eb4~ | Eb3+Eb4~ |
  Eb3+Eb4~ | Eb3+Eb4~ | Eb3+Eb4~ | Eb3+Eb4:4*2 |
  Eb3+Eb4*2 | Bb3+F4:8~ | Bb3+F4:4 Bb2+Bb3 | Bb2+Bb3 r |
  Bb2+Bb3 r | Bb2+Bb3 r | Eb3+Eb4 r | Eb4+G4 r |
  Bb3+F4 Bb2+Bb3~ | Bb2+Bb3:8~ | Bb2+Bb3~ | Bb2+Bb3:4*2 |
  r Bb2+Bb3 | r Eb3+Eb4 | r Eb3+Eb4 | r Eb3+Eb4 |
  r Bb2+Bb3 | Eb3+Eb4 r | r:2 Bb3+Bb4*3 | G3+G4 Eb3+Eb4*3 |
  Bb2+Bb3:8~ | Bb2+Bb3:4 r | r:2 Bb3+Bb4*3 | G3+G4 Eb3+Eb4*3 |
  Bb2+Bb3:8~ | Bb2+Bb3:4 r | r:2 Bb2+Bb3*3 | Eb3+Eb4:4 r |
  r:2 Bb3+F4*3 | Eb3+Eb4:4 r | R R
  `,
);

const trumpets = part(
  `
  R*16
  R r:2 G3+G4*3 | C4+C5:4 r | C4+C5 r |
  G3+G4 r | R R R
  R*16
  R R C4+C5 r | C4+C5 r |
  R R r C4+C5:2*2 | G3+G4:4 r |
  R R r C4+C5:2*2 | C4+C5:8~ |
  C4+C5~ | C4+C5~ | C4+C5 | C4+C5:4 r |
  R*36
  R F5:8~ | F5:4 r | R
  R G3+G4 r | C4+C5 r | R
  R F5:8~ | F5 | G5:4 G4+G5 |
  R r G3+G4 | r C4+C5 | R
  R*16
  `,
);

const timpani = part(
  `
  R*16
  R r:2 G2*3 | C3:4 r | C3 r |
  G2 r | R R R
  R*16
  R R C3 r | C3 r |
  R R r C3:2*2 | G2:4 r |
  R R r C3:2*2 | C3:8 |
  C3 | C3 | C3 | C3:4 r |
  R*40
  R G2 r | C3 r | R
  R R R r G2 |
  R r G2 | r C3 | R
  R*16
  `,
);

const violinsI = part(
  `
  r:2 G4*3 | Eb4:8 | r:2 F4*3 | D4:8~ |
  D4 | R R r:2 Eb5*3 |
  C5:8~ | C5:4 r | R r:2 F5*3 |
  D5:8~ | D5:2 G5*2 F5 | Eb5:8 | D5:2 G5*2 F5 |
  Eb5:8 | D5:2 G5*2 F5 | Eb5:4 r | A3+F#4+C5 r |
  G5:8 | r:2 Ab4*3 | F4:8~ | F4 |
  r:2 Ab4*3 | F4:8~ | F4~ | F4 |
  Eb4:2 Ab4*3 | F4:8~ | F4~ | F4 |
  Eb4:2 G4 C5*2 | C5:8 | B4:2*3 D5 | D5:8 |
  C5:2*3 Eb5 | Eb5 D5*2 F5 | F5 E5*2 G5 | G5 F5*2 Ab5 |
  Ab5 G5*2 Bb5 | Bb5 Ab5*2 C6 | C6 B5*2 D6 | C6 Eb6*3 |
  C6 G5*3 | Eb5 C5 G4*2 | Eb4 C4*3 | B3 F6 D6*2 |
  B5 G5 F5*2 | D5 B4 G4 F4 | D4 B3 C4*2 | C4 Eb6*3 |
  C6 A5*3 | F#5 Eb5*3 | C5 A3+A4*3 | A3+A4:4 r |
  R Bb3+F4+Bb4 r | R R
  R R Bb4 Eb5 | D5 Eb5 |
  F5 C5 | C5 Bb4 | R R
  R R Bb4 Eb5 | D5 Eb5 |
  F5 C5 | C5 Bb4 | Bb4 C5 | Db5 C5 |
  Bb4 C5 | Bb4 Ab4 | Db5 Eb5 | F5 Eb5 |
  Db5 Eb5 | Db5 C5 | Eb5 F5 | F#5 F5 |
  Eb5 F5 | F#5 F5 | Eb5 F5 | F#5 F5 |
  Eb5 F5 | F#5 F5 | Eb5 F5 | F#5 F5 |
  F#5 A5 | Bb4+Bb5:8~ | Bb4+Bb5:2 C6 Bb5 Ab5 | Ab5 G5 F5 Eb5 |
  Eb5 D5 C5 D5 | F5 Eb5 Bb4 G4 | D5 C5 Ab4 F4 | C5 Bb4 G4 Eb4 |
  Bb3 A5 Bb5 A5 | Bb5 A5 Bb5 A5 | Bb5 C6 Bb5 Ab5 | Ab5 G5 F5 Eb5 |
  Eb5 D5 C5 D5 | F5 Eb5 Bb4 G4 | D5 C5 Ab4 F4 | C5 Bb4 G4 Eb4 |
  Bb3 Bb4 Bb5*2 | Eb5:8~ | Eb5~ | Eb5~ |
  Eb5:2 F5*3 | G5:8~ | G5~ | G5~ |
  G5:2 Bb4+Bb5*3 | Bb4+Bb5:4 r | r:2 Bb4+Bb5*3 | Bb4+Bb5:4 r |
  r:2 F5+D6*3 | G5+Eb6:4 r | R R
  `,
  `
  R*20
  G3+D4+B4:4 r | R R R
  R*100
  `,
);

const violinsII = part(
  `
  r:2 G4*3 | Eb4:8 | r:2 F4*3 | D4:8~ |
  D4 | r:2 G4*3 | Eb4:8~ | Eb4~ |
  Eb4~ | Eb4:2 G4*3 | D4:8~ | D4 |
  G4~ | G4~ | G4:2 Eb4*2 F4 | G4:8~ |
  G4:2 Eb4*2 F4 | G4 D5*2 G4 | C4+G4+Eb5:4 r | A3+F#4+C5 r |
  G3+D4+B4 r | r:2 Ab4*3 | F4:8~ | F4 |
  R r:2 D4*3 | B3:8~ | B3 |
  C4:4 r | r:2 D4*3 | B3:8~ | B3 |
  C4:2 G4*2 Eb4 | F4:8~ | F4:2 Ab4*2 F4 | G4:8~ |
  G4:2*3 Eb4 | Ab4*3 F4 | Bb4*3 G4 | C5 C4*2 Ab3 |
  E4*3 Bb3 | F4*3 C4 | Ab4*3 F4 | G4 Eb4+C5*3 |
  Eb4+C5:8 | Eb4+C5 | Eb4+C5 | D4+B4:2 F5 D5*2 |
  B4 G4 F4*2 | D4 B3 G3 F4 | D4 B3 C4*2 | C5 Eb5*3 |
  C5 A4*3 | F#4 Eb4*3 | C4 A3+A4*3 | A3+A4:4 r |
  R Bb3+F4+Bb4 r | R R
  R R G4:8 | Ab4 |
  Ab4 | G4 | G4 | Ab4 |
  Ab4 | G4 | G4 | Ab4 |
  Ab4 | G4 | G4~ | G4 |
  G4 | F4 | Ab4 | Bb4 |
  Bb4 | Ab4 | Eb4:4 F4 | F#4 F4 |
  Eb4 F4 | F#4 F4 | Eb4 F4 | F#4 F4 |
  Eb4 F4 | F#4 F4 | Eb4 F4 | F#4 F4 |
  F#4 A4 | Bb4+Bb5:8~ | Bb4+Bb5:2 C6 Bb5 Ab5 | Ab5 G5 F5 Eb5 |
  Eb5 D5 C5 D5 | F5 Eb5 Bb4 G4 | D5 C5 Ab4 F4 | C5 Bb4 G4 Eb4 |
  Bb3 A4 Bb4 A4 | Bb4 A4 Bb4 A4 | Bb4 C6 Bb5 Ab5 | Ab5 G5 F5 Eb5 |
  Eb5 D5 C5 D5 | F5 Eb5 Bb4 G4 | D5 C5 Ab4 F4 | C5 Bb4 G4 Eb4 |
  Bb3 Bb4 Bb5*2 | Eb4:8~ | Eb4~ | Eb4~ |
  Eb4:2 D4*3 | Eb4:8~ | Eb4~ | Eb4~ |
  Eb4:2 F4+D5*3 | G4+Eb5:4 r | r:2 F4+D5*3 | G4+Eb5:4 r |
  r:2 Bb4+F5*3 | Eb4+Bb4+G5:4 r | R R
  `,
);

const violas = part(
  `
  r:2 G3*3 | Eb3:8 | r:2 F3*3 | D3:8~ |
  D3 | R r:2 Ab4*3 | G4:8~ |
  G4~ | G4:4 r | r:2 Ab4*3 | G4:8 |
  D4~ | D4 | Eb4:2*3 F4 | G4:8~ |
  G4:2 Eb4*2 F4 | G4:6 D4:2 | Eb4:4 r | Ab3 r |
  G3 r | r:2 Ab3*3 | F3:8~ | F3 |
  R R r:2 Ab3*3 | G3:8~ |
  G3:4 r | R r:2 Ab3*3 | G3:8~ |
  G3:2 Eb4*2 C4 | D4:8~ | D4:2 F4*2 D4 | Eb4:8~ |
  Eb4:2*3 C4 | F4*3 B3 | G4*3 Bb3 | Ab4 Ab3*2 F3 |
  Bb3*3 G3 | C4*3 Ab3 | F4*3 D4 | Eb4 C3+Eb3*3 |
  C3+Eb3:8 | C3+Eb3 | C3+Eb3 | D3+F3 |
  D3+F3 | D3+F3 | D3+F3:2*2 C3+Eb3*2 | C3+Eb3 Eb3+F#3*3 |
  Eb3+F#3:8 | Eb3+F#3 | Eb3+F#3 | Eb3+F#3:4 r |
  R F3 r | R R
  R R Eb4:8 | F4 |
  D4 | Eb4 | Eb4 | F4 |
  D4 | Eb4 | Eb4 | F4 |
  D4 | Eb4 | Eb4 | E4 |
  E4 | C4 | F4 | G4 |
  G4 | D4 | R r:2 A3*3 |
  A3:4 r | r:2 Bb3*3 | Bb3:4 r | r:2 B3*3 |
  B3:4 r | r:2 C4*3 | C4:4 r | r:2 C4*3 |
  C4:4 C4:2*2 | D4:8~ | D4:4 D3 | Eb3 r |
  F3 r | G3 r | Ab3 r | Bb3 r |
  Bb3 r | F3:2*2 Bb3*2 | F3*2 Bb3*2 | G3*2 Bb3*2 |
  Ab3*2 Bb3*2 | F4 Eb4 Bb3 G3 | D4 C4 Ab3 F3 | C4 Bb3 G3 Eb3 |
  D3 F3+D4 Ab3+F4 F3+D4 | G3:8~ | G3~ | G3~ |
  G3:2 Bb3*3 | Bb3:8~ | Bb3~ | Bb3~ |
  Bb3:2*4 | Bb3:4 r | r:2 Bb3*3 | Bb3:4 r |
  r:2 Bb3*3 | Eb4:4 r | R R
  `,
);

const cellos = part(
  `
  r:2 G2*3 | Eb2:8 | r:2 F2*3 | D2:8~ |
  D2 | R C4~ | C4~ |
  C4~ | C4 | B3~ | B3~ |
  B3~ | B3 | C4 | B3 |
  C4 | B3:2*4 | C4:4 r | Ab2 r |
  G2 r | r:2 Ab2*3 | F2:8~ | F2 |
  R R R r:2 G2*3 |
  C3:4 r | R R r:2 G2*3 |
  C3:4 r | r:2 C3*3 | C3:4 r | r:2 C3*3 |
  C3:4 r | C3 r | C3 r | C3 r |
  C3 r | C3 r | C3 r | C3:8~ |
  C3~ | C3~ | C3:2*4 | G2:8~ |
  G2~ | G2~ | G2:2*2 C3*2 | C3:8 |
  C3 | C3 | C3 | C3:4 r |
  R D3 r | R R
  R*4
  r:2 Bb2*3 | Eb3:4 r | R R
  r:2 Bb2*3 | Eb3:4 r | R R
  r:2 Bb2*3 | Eb3:4 r | R R
  r:2 C3*3 | F3:4 r | R R
  r:2 Eb3*3 | Ab3:4 r | Eb4 F4 | F#4 F4 |
  Eb4 F4 | F#4 F4 | Eb4 F4 | F#4 F4 |
  Eb4 F4 | F#4 F4 | Eb4 F4 | F#4 F4 |
  F#4 C4 | D4:8~ | D4:4 D3 | Eb3 r |
  F3 r | G3 r | Ab3 r | Bb3 r |
  Bb2 r | D3 F3 | D3 F3 | Eb3 G3 |
  F3 Ab3 | G3 Bb3 | Ab3 C4 | Bb3 Bb2 |
  Bb3 Bb2 | Eb3:8~ | Eb3~ | Eb3~ |
  Eb3:2 Bb2*3 | Eb3:8~ | Eb3~ | Eb3~ |
  Eb3:2 Bb2*3 | Eb3:4 r | r:2 Bb2*3 | Eb3:4 r |
  r:2 Bb2*3 | Eb3:4 r | R R
  `,
);

const basses = part(
  `
  r:2 G3*3 | Eb3:8 | r:2 F3*3 | D3:8~ |
  D3 | R R R
  R*8
  R r:2 B2*3 | C3:4 r | Ab2 r |
  G2 r | r:2 Ab2*3 | F2:8~ | F2 |
  R R R r:2 G2*3 |
  C3:4 r | R R r:2 G2*3 |
  C3:4 r | r:2 C3*3 | C3:4 r | r:2 C3*3 |
  C3:4 r | C3 r | C3 r | C3 r |
  C3 r | C3 r | C3 r | C3:8~ |
  C3~ | C3~ | C3:2*4 | G2:8~ |
  G2~ | G2~ | G2:2*2 C3*2 | C3:8 |
  C3 | C3 | C3 | C3:4 r |
  R D3 r | R R
  R*4
  r:2 Bb2*3 | Eb3:4 r | R R
  r:2 Bb2*3 | Eb3:4 r | R R
  r:2 Bb2*3 | Eb3:4 r | R R
  r:2 C3*3 | F3:4 r | R R
  r:2 Eb3*3 | Ab3:4 r | R r:2 A3*3 |
  A3:4 r | r:2 Bb3*3 | Bb3:4 r | r:2 B3*3 |
  B3:4 r | r:2 C4*3 | C4:4 r | r:2 C4*3 |
  C4:4 C4:2*2 | D4:8~ | D4:4 D3 | Eb3 r |
  F3 r | G3 r | Ab3 r | Bb3 r |
  Bb2 r | D3 F3 | D3 F3 | Eb3 G3 |
  F3 Ab3 | G3 Bb3 | Ab3 C4 | Bb3 Bb2 |
  Bb3 Bb2 | Eb3:8~ | Eb3~ | Eb3~ |
  Eb3:2 Bb2*3 | Eb3:8~ | Eb3~ | Eb3~ |
  Eb3:2 Bb2*3 | Eb3:4 r | r:2 Bb2*3 | Eb3:4 r |
  r:2 Bb2*3 | Eb3:4 r | R R
  `,
);

export default defineSong({
  title: 'Symphony No. 5 (First Movement, Exposition)',
  description: 'Beethoven, Op. 67, bars 1-124 for full orchestra: the four-note motto, the horn call and the lyrical second theme in E-flat.',
  bpm: 192,
  meter: '2/4',
  loop: false,
  reverb: { size: 2.4, damp: 0.45, preDelay: 0.025, mix: 0.9 },
  tracks: [
    { name: 'Flutes', instrument: 'flute', part: flutes, gain: 0.55, pan: -0.1 },
    { name: 'Oboes', instrument: 'oboe', part: oboes, gain: 0.55, pan: 0.1 },
    { name: 'Clarinets', instrument: 'clarinet', part: clarinets, gain: 0.6, pan: -0.15 },
    { name: 'Bassoons', instrument: 'bassoon', part: bassoons, gain: 0.6, pan: 0.15 },
    { name: 'Horns', instrument: 'horns', part: horns, gain: 0.6, pan: -0.3 },
    { name: 'Trumpets', instrument: 'trumpets', part: trumpets, gain: 0.5, pan: 0.3 },
    { name: 'Timpani', instrument: 'timpani', part: timpani, gain: 0.9, reverb: 0.35 },
    { name: 'Violins I', instrument: 'strings', part: violinsI, gain: 0.85, pan: -0.5 },
    { name: 'Violins II', instrument: 'strings', part: violinsII, gain: 0.75, pan: -0.25 },
    { name: 'Violas', instrument: 'strings', part: violas, gain: 0.7, pan: 0.2 },
    { name: 'Cellos', instrument: 'celli', part: cellos, gain: 0.8, pan: 0.4 },
    // The double basses sound an octave below where they are written
    { name: 'Double basses', instrument: 'contrabass', part: basses, gain: 0.85, pan: 0.55, transpose: -12 },
  ],
});
