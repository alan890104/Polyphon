// The visualizer's shared shapes: the frame every layer draws from, the layer interface, and the entries the registries list.

import type { NoteTimeline } from './timeline.ts';
import type { Theme } from './themes.ts';

/** How much the engine may spend: canvas resolution and particle counts go down with it */
export type Quality = 'high' | 'medium' | 'low';

/** What a layer is handed every frame */
export interface FrameData {
  /** Seconds since the engine started (wall clock, for idle motion) */
  time: number;
  /** Seconds since the previous frame (capped, so a stall never jumps the animation) */
  dt: number;
  /** Size in CSS pixels */
  width: number;
  height: number;

  /** The analyser's spectrum, 0-255 per bin (dB-scaled by the analyser) */
  frequency: Uint8Array;
  /** The analyser's waveform, -1 to 1 */
  waveform: Float32Array;
  /** Hz per frequency bin */
  binHz: number;
  /** The spectrum on a logarithmic scale (32 Hz to 16 kHz), 0-1 per band, smoothed and levelled */
  bands: Float32Array;
  /** Smoothed energy, 0-1 */
  bass: number;
  mid: number;
  treble: number;
  /** Overall loudness, 0-1 */
  level: number;
  /** True on the frame an onset (a beat) is detected in the low band */
  beat: boolean;
  /** 1 on a beat, decaying to 0 */
  pulse: number;

  /** Seconds into the song, read from the audio clock */
  position: number;
  /** Seconds the song lasts (0 when there is none) */
  duration: number;
  playing: boolean;
  /** Every note of the current song in seconds (null when nothing is loaded) */
  timeline: NoteTimeline | null;

  theme: Theme;
  /** 0-1: how far things move, burst and pulse */
  motion: number;
  /** 0.5-2: how strongly the visuals answer the music */
  sensitivity: number;
  quality: Quality;
  /** Style options */
  mirror: boolean;
  layered: boolean;
  /** The listener's picture, for the image background */
  image: CanvasImageSource | null;
}

/** The canvas a layer draws on */
export interface Surface {
  canvas: HTMLCanvasElement;
  /** Size in CSS pixels */
  width: number;
  height: number;
  /** Backing-store pixels per CSS pixel */
  scale: number;
}

/** A visual style or a background: one canvas, drawn once per frame */
export interface Layer {
  /** Take the canvas and set up; false when this layer cannot run here (no WebGL), and the engine tries the fallback */
  init(surface: Surface): boolean;
  /** The canvas changed size (its context state was reset) */
  resize(surface: Surface): void;
  frame(frame: FrameData): void;
  dispose(): void;
  /** CSS pixels at the bottom taken by fixed furniture (the piano keyboard): the view keeps its controls above them */
  inset?(): number;
  /** It paints every pixel itself (a room of its own): no background is drawn under it */
  readonly opaque?: boolean;
}

/** An entry in a registry: how to make the layer, at what resolution, and what to use when it cannot run */
export interface LayerKind<Id extends string = string> {
  id: Id;
  name: string;
  /** One line for the settings drawer */
  description: string;
  /** Backing-store resolution as a fraction of the device pixel ratio (soft backgrounds draw at less) */
  resolution?: number;
  /** The most backing-store pixels per CSS pixel, whatever the screen (a 3D scene costs per pixel) */
  maxScale?: number;
  create(): Layer;
  fallback?: () => Layer;
}
