// The piano keyboard the falling notes land on: which keys it shows (all 88, or the song's range on narrow screens) and where each
// key sits, in CSS pixels.

/** A0 to C8 */
export const PIANO_LOW = 21;
export const PIANO_HIGH = 108;

const BLACK = [false, true, false, true, false, false, true, false, true, false, true, false];
/** How far each black key sits off the line between its white neighbours, in white-key widths (as on a real keyboard) */
const BLACK_OFFSET = [0, -0.08, 0, 0.08, 0, 0, -0.1, 0, 0, 0, 0.1, 0];

export const isBlack = (midi: number): boolean => BLACK[((midi % 12) + 12) % 12];

export interface Key {
  x: number;
  width: number;
  black: boolean;
}

export class KeyboardLayout {
  readonly low: number;
  readonly high: number;
  readonly whiteWidth: number;
  readonly blackWidth: number;
  /** By MIDI pitch minus `low` */
  readonly keys: Key[];

  constructor(low: number, high: number, width: number) {
    this.low = isBlack(low) ? low - 1 : low;
    this.high = isBlack(high) ? high + 1 : high;
    let whites = 0;
    for (let m = this.low; m <= this.high; m++) if (!isBlack(m)) whites++;
    this.whiteWidth = width / whites;
    this.blackWidth = this.whiteWidth * 0.6;
    this.keys = [];
    let white = 0;
    for (let m = this.low; m <= this.high; m++) {
      if (isBlack(m)) {
        const center = white * this.whiteWidth + BLACK_OFFSET[m % 12] * this.whiteWidth;
        this.keys.push({ x: center - this.blackWidth / 2, width: this.blackWidth, black: true });
      } else {
        this.keys.push({ x: white * this.whiteWidth, width: this.whiteWidth, black: false });
        white++;
      }
    }
  }

  key(midi: number): Key | undefined {
    return this.keys[midi - this.low];
  }

  /** The keys to show for a song: the whole piano when there is room, otherwise whole octaves around the song's range */
  static fit([low, high]: readonly [number, number], width: number): KeyboardLayout {
    if (width >= 900) return new KeyboardLayout(PIANO_LOW, PIANO_HIGH, width);
    let from = Math.max(PIANO_LOW, Math.floor((low - 1) / 12) * 12);
    let to = Math.min(PIANO_HIGH, Math.ceil((high + 1) / 12) * 12);
    while (to - from < 24) {
      if (from > PIANO_LOW) from -= 12;
      if (to - from < 24 && to < PIANO_HIGH) to += 12;
      if (from <= PIANO_LOW && to >= PIANO_HIGH) break;
    }
    return new KeyboardLayout(Math.max(PIANO_LOW, from), Math.min(PIANO_HIGH, to), width);
  }
}

/** "C4" for MIDI 60 */
export function octaveName(midi: number): string {
  return `C${Math.floor(midi / 12) - 1}`;
}
