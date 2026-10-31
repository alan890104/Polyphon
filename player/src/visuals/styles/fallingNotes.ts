// Falling notes: the song's notes fall onto a piano keyboard and land exactly when they sound (they are read from the score and
// placed by the audio clock), coloured by track. Keys light while their notes sound; drums pulse the line the notes land on.

import { Layer2D } from '../layer2d.ts';
import { alpha, mix, trackColor, type Theme } from '../themes.ts';
import type { NoteTimeline, TimedNote } from '../timeline.ts';
import type { FrameData, LayerKind } from '../types.ts';
import { isBlack, KeyboardLayout, octaveName } from './keyboard.ts';

/** Notes drawn at most per frame */
const CAPACITY = 2048;
const SPARKS = 240;
/** Notes fade in over this much of the height at the top, which keeps the title clear */
const FADE = 0.22;
/** Seconds a drum hit keeps the landing line lit */
const DRUM_DECAY = 0.14;
const MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

class FallingNotes extends Layer2D {
  private keyboard = new KeyboardLayout(21, 108, 1);
  private keyboardFor: NoteTimeline | null | undefined;
  private keysHeight = 0;
  private hitY = 0;
  /** Pixels per second of fall */
  private speed = 0;
  private lookahead = 2.6;
  private previous = -1;
  /** The colour lighting each key this frame (by MIDI pitch minus the keyboard's lowest), or null */
  private lit: (string | null)[] = [];
  // The notes in view, gathered once per frame and drawn in batches of one colour
  private readonly nx = new Float32Array(CAPACITY);
  private readonly ny = new Float32Array(CAPACITY);
  private readonly nw = new Float32Array(CAPACITY);
  private readonly nh = new Float32Array(CAPACITY);
  private readonly order = new Uint32Array(CAPACITY);
  private count = 0;
  // Sparks thrown up where a note lands
  private readonly sx = new Float32Array(SPARKS);
  private readonly sy = new Float32Array(SPARKS);
  private readonly svx = new Float32Array(SPARKS);
  private readonly svy = new Float32Array(SPARKS);
  private readonly life = new Float32Array(SPARKS);
  private readonly sparkColor: string[] = new Array<string>(SPARKS).fill('');
  private nextSpark = 0;
  private glows = new Map<string, HTMLCanvasElement>();
  private palette: { theme: Theme | null; lit: string[]; active: string[] } = { theme: null, lit: [], active: [] };

  protected layout(): void {
    this.keyboardFor = undefined;
  }

  inset(): number {
    return this.keysHeight;
  }

  frame(f: FrameData): void {
    const { g, width, height } = this;
    g.clearRect(0, 0, width, height);
    this.prepare(f);
    const position = f.position;
    const seeking = Math.abs(position - this.previous) > 0.5;
    this.lit.fill(null);

    this.drawGuides(f);
    let drums = 0;
    if (f.timeline) drums = this.gatherNotes(f, f.timeline, seeking);
    this.drawNotes(f);
    this.fadeTop();
    this.drawLanding(f, drums);
    this.drawKeys(f.theme);
    this.drawSparks(f);
    this.previous = position;
  }

  /** Lay out the keyboard for the song and the screen, and the colours for the theme */
  private prepare(f: FrameData): void {
    if (this.keyboardFor !== f.timeline) {
      this.keyboardFor = f.timeline;
      this.keyboard = KeyboardLayout.fit(f.timeline?.range ?? [48, 84], this.width);
      this.lit = new Array<string | null>(this.keyboard.keys.length).fill(null);
      const natural = this.keyboard.whiteWidth * 5.6;
      this.keysHeight = Math.round(Math.min(Math.max(56, natural), this.height * 0.16, 170));
      this.hitY = this.height - this.keysHeight;
      this.lookahead = this.width < 700 ? 2.1 : 2.6;
      this.speed = this.hitY / this.lookahead;
    }
    if (this.palette.theme !== f.theme) {
      const tracks = f.theme.tracks.length;
      this.palette = {
        theme: f.theme,
        lit: Array.from({ length: tracks }, (_, i) => mix(trackColor(f.theme, i), f.theme.paper, 0.15)),
        active: Array.from({ length: tracks }, (_, i) => mix(trackColor(f.theme, i), f.theme.paper, 0.3)),
      };
      this.glows.clear();
    }
  }

  /** Bar lines with their numbers, and a faint line at every C */
  private drawGuides(f: FrameData): void {
    const { g, width, hitY, keyboard } = this;
    const theme = f.theme;
    g.fillStyle = alpha(theme.muted, 0.07);
    for (let m = keyboard.low; m <= keyboard.high; m++) {
      if (m % 12 !== 0) continue;
      const key = keyboard.key(m);
      if (key) g.fillRect(Math.round(key.x), 0, 1, hitY);
    }
    const timeline = f.timeline;
    if (!timeline) return;
    g.font = `500 10px ${MONO}`;
    g.textAlign = 'left';
    g.textBaseline = 'bottom';
    timeline.forEachBar(f.position, f.position + this.lookahead, (at, bar) => {
      const y = Math.round(hitY - (at - f.position) * this.speed);
      if (y < this.height * FADE) return;
      g.fillStyle = alpha(theme.muted, 0.16);
      g.fillRect(0, y, width, 1);
      g.fillStyle = alpha(theme.muted, 0.6);
      g.fillText(String(bar), 8, y - 3);
    });
  }

  /** Place every note in view; light the keys of sounding notes and throw sparks for the ones landing now. Returns the drum level. */
  private gatherNotes(f: FrameData, timeline: NoteTimeline, seeking: boolean): number {
    const { keyboard, hitY, speed } = this;
    const position = f.position;
    let count = 0;
    let drums = 0;
    timeline.forEach(position - DRUM_DECAY * 4, position + this.lookahead, (n: TimedNote, offset: number) => {
      const start = n.start + offset;
      const end = n.end + offset;
      if (n.pitch < 0) {
        const age = position - start;
        if (age >= 0) drums = Math.max(drums, n.velocity * Math.exp(-age / DRUM_DECAY));
        return;
      }
      const key = keyboard.key(n.pitch);
      if (!key || end <= position || count >= CAPACITY) return;
      const sounding = start <= position;
      const colour = n.track % f.theme.tracks.length;
      if (sounding) this.lit[n.pitch - keyboard.low] = this.palette.lit[colour];
      if (sounding && !seeking && start > this.previous) this.spark(key.x + key.width / 2, f, colour, n.velocity);
      const bottom = Math.min(hitY, hitY - (start - position) * speed);
      // A small gap at the top keeps repeated notes on one key apart
      const top = hitY - (end - position) * speed + 2;
      if (bottom - top < 1.5) return;
      const w = key.black ? key.width * 0.9 : key.width * 0.78;
      this.nx[count] = key.x + (key.width - w) / 2;
      this.ny[count] = top;
      this.nw[count] = w;
      this.nh[count] = bottom - top;
      // Sort key: black keys after white (drawn on top), then colour, loudness and whether it sounds, then the note's slot
      const loud = n.velocity > 0.72 ? 2 : n.velocity > 0.45 ? 1 : 0;
      this.order[count] = ((((key.black ? 1 : 0) * 64 + colour) * 3 + loud) * 2 + (sounding ? 1 : 0)) * CAPACITY + count;
      count++;
    });
    this.count = count;
    return drums;
  }

  /** Draw the gathered notes, one fill per colour, loudness and state */
  private drawNotes(f: FrameData): void {
    const { g } = this;
    const order = this.order.subarray(0, this.count).sort();
    const radius = Math.min(4, this.keyboard.whiteWidth * 0.18);
    let group = -1;
    for (let k = 0; k <= order.length; k++) {
      const next = k < order.length ? Math.floor(order[k] / CAPACITY) : -2;
      if (next !== group) {
        if (group >= 0) g.fill();
        if (next < 0) break;
        group = next;
        const sounding = group % 2 === 1;
        const loud = Math.floor(group / 2) % 3;
        const colour = Math.floor(group / 6) % 64;
        g.fillStyle = sounding ? this.palette.active[colour] : trackColor(f.theme, colour);
        g.globalAlpha = sounding ? 1 : 0.62 + loud * 0.17;
        g.beginPath();
      }
      const i = order[k] % CAPACITY;
      g.roundRect(this.nx[i], this.ny[i], this.nw[i], this.nh[i], Math.min(radius, this.nh[i] / 2));
    }
    g.globalAlpha = 1;
  }

  /** Notes fade in at the top instead of being cut by the edge */
  private fadeTop(): void {
    const { g, width, height } = this;
    const depth = height * FADE;
    const fade = g.createLinearGradient(0, 0, 0, depth);
    fade.addColorStop(0, 'rgba(0, 0, 0, 1)');
    fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = fade;
    g.fillRect(0, 0, width, depth);
    g.globalCompositeOperation = 'source-over';
  }

  /** The line notes land on: brass, with a glow that drums and the bass raise, and a bloom over every sounding key */
  private drawLanding(f: FrameData, drums: number): void {
    const { g, width, hitY, keyboard } = this;
    const theme = f.theme;
    const strength = Math.min(1, 0.1 + drums * 0.55 * Math.max(0.4, f.motion) + f.bass * 0.15);
    const band = Math.max(18, this.keysHeight * 0.35);
    const glow = g.createLinearGradient(0, hitY - band, 0, hitY);
    glow.addColorStop(0, alpha(theme.accent, 0));
    glow.addColorStop(1, alpha(theme.accent, 0.22 * strength));
    g.fillStyle = glow;
    g.fillRect(0, hitY - band, width, band);
    for (let i = 0; i < this.lit.length; i++) {
      const colour = this.lit[i];
      if (!colour) continue;
      const key = keyboard.keys[i];
      const size = Math.max(36, key.width * 3.2);
      g.globalAlpha = 0.55;
      g.drawImage(this.glow(colour), key.x + key.width / 2 - size / 2, hitY - size / 2, size, size);
    }
    g.globalAlpha = 1;
    g.fillStyle = alpha(theme.accent, 0.55 + strength * 0.45);
    g.fillRect(0, hitY - 1, width, 1.5);
  }

  /** The keyboard: white keys in paper, black keys in raised ink, each lit in the colour of the note it plays */
  private drawKeys(theme: Theme): void {
    const { g, keyboard, hitY, keysHeight } = this;
    const ivory = mix(theme.paper, theme.ink, 0.2);
    const blackHeight = keysHeight * 0.62;
    // White keys: unlit ones in one fill, then lit ones
    g.fillStyle = ivory;
    g.beginPath();
    keyboard.keys.forEach((key, i) => {
      if (!key.black && !this.lit[i]) g.rect(key.x + 0.5, hitY + 1, key.width - 1, keysHeight - 1);
    });
    g.fill();
    keyboard.keys.forEach((key, i) => {
      const colour = this.lit[i];
      if (key.black || !colour) return;
      g.fillStyle = colour;
      g.fillRect(key.x + 0.5, hitY + 1, key.width - 1, keysHeight - 1);
    });
    // A shadow under the landing line, as if the keys sat below a rail
    const shade = g.createLinearGradient(0, hitY, 0, hitY + keysHeight * 0.18);
    shade.addColorStop(0, alpha(theme.ink, 0.45));
    shade.addColorStop(1, alpha(theme.ink, 0));
    g.fillStyle = shade;
    g.fillRect(0, hitY + 1, this.width, keysHeight * 0.18);
    // Black keys
    keyboard.keys.forEach((key, i) => {
      if (!key.black) return;
      const colour = this.lit[i];
      g.fillStyle = colour ?? theme.raised;
      g.fillRect(key.x, hitY + 1, key.width, blackHeight);
      if (!colour) {
        g.fillStyle = alpha(theme.paper, 0.1);
        g.fillRect(key.x + 1, hitY + blackHeight - 3, key.width - 2, 2);
      }
    });
    // Octave names on the C keys, when they fit
    if (keyboard.whiteWidth < 13) return;
    g.font = `500 ${Math.min(10, keyboard.whiteWidth * 0.42)}px ${MONO}`;
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.fillStyle = alpha(theme.ink, 0.55);
    for (let m = keyboard.low; m <= keyboard.high; m++) {
      if (m % 12 !== 0 || isBlack(m)) continue;
      const key = keyboard.key(m);
      if (key) g.fillText(octaveName(m), key.x + key.width / 2, hitY + keysHeight - 6);
    }
  }

  private spark(x: number, f: FrameData, colour: number, velocity: number): void {
    const count = Math.round((1 + velocity * 3) * f.motion);
    for (let k = 0; k < count; k++) {
      const i = this.nextSpark;
      this.nextSpark = (i + 1) % SPARKS;
      this.sx[i] = x + (Math.random() - 0.5) * this.keyboard.whiteWidth * 0.6;
      this.sy[i] = this.hitY - 2;
      this.svx[i] = (Math.random() - 0.5) * 60;
      this.svy[i] = -(50 + Math.random() * 110) * (0.6 + velocity * 0.6);
      this.life[i] = 1;
      this.sparkColor[i] = this.palette.active[colour];
    }
  }

  private drawSparks(f: FrameData): void {
    const { g } = this;
    for (let i = 0; i < SPARKS; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= f.dt * 1.8;
      this.svy[i] += f.dt * 90;
      this.sx[i] += this.svx[i] * f.dt;
      this.sy[i] += this.svy[i] * f.dt;
      if (this.life[i] <= 0 || this.sy[i] > this.hitY) continue;
      g.globalAlpha = this.life[i] * 0.9;
      g.fillStyle = this.sparkColor[i];
      g.fillRect(this.sx[i] - 0.75, this.sy[i] - 0.75, 1.5, 1.5);
    }
    g.globalAlpha = 1;
  }

  /** A soft round glow in a colour (drawn once per colour) */
  private glow(colour: string): HTMLCanvasElement {
    let sprite = this.glows.get(colour);
    if (sprite) return sprite;
    sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const s = sprite.getContext('2d');
    if (s) {
      const gradient = s.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, alpha(colour, 0.9));
      gradient.addColorStop(0.35, alpha(colour, 0.3));
      gradient.addColorStop(1, alpha(colour, 0));
      s.fillStyle = gradient;
      s.fillRect(0, 0, 64, 64);
    }
    this.glows.set(colour, sprite);
    return sprite;
  }
}

export const fallingNotes: LayerKind<'notes'> = {
  id: 'notes',
  name: 'Falling notes',
  description: 'The score falling onto a piano keyboard, landing as each note sounds',
  create: () => new FallingNotes(),
};
