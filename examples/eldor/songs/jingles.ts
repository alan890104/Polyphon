// Short jingles (play once): victory, defeat, fanfare. They use the same orchestra as the score, and both victory and defeat quote the leitmotif (the A -> F# sixth leap).

import { arpeggio, chords, melody, pad, rest, rhythm, sequence, type Song } from 'polyphon';

/** Small fanfare (treasure chest, contracting, tactic, summary): a D major triad rushing upward, with the glockenspiel scattered behind */
export const fanfareSmall: Song = {
  title: '小號角',
  description: '短促明亮的號角',
  bpm: 140,
  loop: false,
  reverb: { size: 1.6, damp: 0.35, mix: 0.8 },
  tracks: [
    { instrument: 'trumpet', part: 'D5:1 F#5:1 A5:1 !D6:9 r:4', gain: 0.9, reverb: 0.3 },
    { instrument: 'harp', part: 'D4:1 F#4:1 A4:1 D5:1 F#5:1 A5:1 D6:6 r:4', gain: 0.7, pan: -0.3, reverb: 0.35 },
    { instrument: 'glock', part: 'r:3 D6:1 F#6:1 A6:1 D7:6 r:4', gain: 0.55, pan: 0.3, reverb: 0.45 },
  ],
};

/** Big fanfare (breakthrough): the leitmotif rushes up to D6, with choir and cymbal */
export const fanfareBig: Song = {
  title: '大號角',
  description: '突破的輝煌瞬間',
  bpm: 120,
  loop: false,
  reverb: { size: 2.2, damp: 0.35, mix: 0.9 },
  tracks: [
    { instrument: 'trumpets', part: 'A4:2 F#5:4 E5:1 D5:1 E5:2 !A5:6 | !D6:12 r:4', gain: 0.85, reverb: 0.35 },
    { instrument: 'horns', part: 'D4:2 A4:4 A4:1 F#4:1 A4:2 !C#5:6 | !A4:12 r:4', gain: 0.7, pan: -0.25, reverb: 0.4 },
    { instrument: 'strings', part: pad(chords('D | D'), { center: 60 }), gain: 0.7, reverb: 0.4, params: { attack: 0.05 } },
    { instrument: 'choir', part: sequence(rest(1), melody('D4+F#4+A4+D5:12 r:4')), gain: 0.7, reverb: 0.5, params: { attack: 0.08 } },
    { instrument: 'timpani', part: '!D3:1 D3:1 D3:1 D3:1 A2:4 D3:8 | !D3:8 r:8', gain: 0.8, reverb: 0.3 },
    { instrument: 'harp', part: arpeggio(chords('D'), '0123456789ab....', { step: 1, center: 60 }), gain: 0.6, pan: 0.3, reverb: 0.4 },
    { instrument: 'crash', part: sequence(rest(1), rhythm('X...............')), gain: 0.6, reverb: 0.3 },
  ],
};

/** Victory: the brass sing the leitmotif, and a plagal cadence G -> D settles on D6 */
export const victory: Song = {
  title: '勝利',
  description: '戰鬥勝利的號角',
  bpm: 124,
  loop: false,
  reverb: { size: 2.2, damp: 0.35, mix: 0.9 },
  tracks: [
    { instrument: 'trumpets', part: 'A4:2 F#5:4 E5:1 D5:1 E5:2 B5:2 A5:4 | !D6:12 r:4', gain: 0.9, reverb: 0.35 },
    { instrument: 'horns', part: 'D4:2 A4:4 A4:1 F#4:1 A4:2 G4:2 E4:4 | F#4:12 r:4', gain: 0.7, pan: -0.25, reverb: 0.4 },
    { instrument: 'strings', part: pad(chords('D | G/D:4 D:12'), { center: 60 }), gain: 0.75, reverb: 0.4, params: { attack: 0.05 } },
    { instrument: 'contrabass', part: 'D2:16 | D2:12 r:4', gain: 0.7 },
    { instrument: 'timpani', part: '!D3:2 A2:2 D3:4 r:8 | !D3:1 D3:1 D3:1 D3:1 !D3:4 r:8', gain: 0.8, reverb: 0.3 },
    { instrument: 'field', part: rhythm('........oooxxxXX|X...............'), gain: 0.5, reverb: 0.25 },
    { instrument: 'harp', part: sequence(arpeggio(chords('D'), '0123456789ab....', { step: 1, center: 60 }), rest(1)), gain: 0.6, pan: 0.3, reverb: 0.4 },
    { instrument: 'glock', part: 'r:16 | D6:2 F#6:2 A6:2 D7:6 r:4', gain: 0.5, pan: 0.35, reverb: 0.5 },
    { instrument: 'crash', part: sequence(rest(1), rhythm('X...............')), gain: 0.65, reverb: 0.3 },
  ],
};

/** Defeat: the minor version of the leitmotif (A -> F, a minor sixth), slowly sinking */
export const defeat: Song = {
  title: '戰敗',
  description: '低落但不絕望',
  bpm: 72,
  loop: false,
  reverb: { size: 2.6, damp: 0.5, mix: 0.9 },
  tracks: [
    { instrument: 'horn', part: 'A4:4 F5:6 E5:2 D5:4 | D5:12 r:4', gain: 0.8, reverb: 0.45 },
    { instrument: 'strPad', part: pad(chords('Dm | Gm/D:8 Dm:8'), { center: 57 }), gain: 0.8, reverb: 0.5 },
    { instrument: 'contrabass', part: 'D2:16 | D2:12 r:4', gain: 0.6 },
    { instrument: 'celesta', part: 'r:16 | r:8 A5:2 F5:2 D5:4', gain: 0.5, pan: 0.3, reverb: 0.6 },
  ],
};

export const JINGLES = { fanfareSmall, fanfareBig, victory, defeat };
export type JingleId = keyof typeof JINGLES;
