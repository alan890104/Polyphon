// The visualizer engine: it owns the canvases (a background and a style stacked on it), the animation frame loop, the device
// pixel ratio and the quality governor. It pauses while the tab is hidden and lowers the resolution when frames run long.

import { Analysis } from './analysis.ts';
import { SongClock, type ClockSource } from './clock.ts';
import type { Theme } from './themes.ts';
import type { NoteTimeline } from './timeline.ts';
import type { FrameData, Layer, LayerKind, Quality, Surface } from './types.ts';

export interface EngineSettings {
  style: LayerKind;
  background: LayerKind;
  theme: Theme;
  /** 0-1 */
  motion: number;
  /** 0.5-2 */
  sensitivity: number;
  mirror: boolean;
  layered: boolean;
}

export interface EngineOptions {
  /** The style's bottom inset changed (CSS pixels) */
  onInset?: (bottom: number) => void;
}

export interface EngineStats {
  /** Script time per frame, smoothed (ms) */
  frameMs: number;
  /** Time between frames, smoothed (ms) */
  intervalMs: number;
  frames: number;
  quality: Quality;
  /** The song position the last frame was drawn at (seconds) */
  position: number;
}

const QUALITIES: readonly Quality[] = ['high', 'medium', 'low'];
/** The most backing-store pixels per CSS pixel at each quality */
const PIXEL_RATIO: Record<Quality, number> = { high: 2, medium: 1.5, low: 1 };
/** Step the quality down when a frame's script takes longer than this (ms, smoothed) */
const BUDGET_MS = 10;
/** ...or when frames come further apart than this (ms, smoothed: under 25 frames a second) */
const SLOW_INTERVAL_MS = 40;
/** Frames to wait after a change before judging again */
const SETTLE_FRAMES = 90;

export class VisualEngine {
  private readonly background: Slot;
  private readonly style: Slot;
  private readonly clock = new SongClock();
  private analysis = new Analysis(null);
  private settings: EngineSettings;
  private timeline: NoteTimeline | null = null;
  private image: CanvasImageSource | null = null;
  private quality: Quality;
  private width = 0;
  private height = 0;
  private raf = 0;
  private last = 0;
  private readonly started = performance.now();
  private settled = 0;
  private inset = 0;
  private readonly observer: ResizeObserver;
  private readonly onInset?: (bottom: number) => void;
  readonly stats: EngineStats;

  constructor(host: HTMLElement, settings: EngineSettings, options: EngineOptions = {}) {
    this.settings = settings;
    this.onInset = options.onInset;
    this.quality = initialQuality();
    this.stats = { frameMs: 0, intervalMs: 16.7, frames: 0, quality: this.quality, position: 0 };
    this.background = new Slot(host, 'immersive__layer immersive__layer--background');
    this.style = new Slot(host, 'immersive__layer immersive__layer--style');
    const box = host.getBoundingClientRect();
    this.width = box.width;
    this.height = box.height;
    this.background.set(settings.background, this.surfaceSize(settings.background));
    this.style.set(settings.style, this.surfaceSize(settings.style));
    this.observer = new ResizeObserver(([entry]) => this.resize(entry.contentRect.width, entry.contentRect.height));
    this.observer.observe(host);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.start();
  }

  setAnalyser(analyser: AnalyserNode | null): void {
    this.analysis = new Analysis(analyser);
  }

  setTimeline(timeline: NoteTimeline | null): void {
    this.timeline = timeline;
  }

  setClock(source: ClockSource): void {
    this.clock.set(source);
  }

  setImage(image: CanvasImageSource | null): void {
    this.image = image;
  }

  update(settings: EngineSettings): void {
    const previous = this.settings;
    this.settings = settings;
    if (settings.background !== previous.background) this.background.set(settings.background, this.surfaceSize(settings.background));
    if (settings.style !== previous.style) this.style.set(settings.style, this.surfaceSize(settings.style));
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.background.dispose();
    this.style.dispose();
  }

  private start(): void {
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) cancelAnimationFrame(this.raf);
    else this.start();
  };

  private readonly loop = (now: number): void => {
    this.raf = requestAnimationFrame(this.loop);
    const interval = now - this.last;
    const dt = Math.min(0.1, Math.max(0, interval / 1000));
    this.last = now;
    if (!this.width || !this.height) return;
    const begin = performance.now();
    const { settings } = this;
    this.analysis.update(dt, settings.sensitivity);
    const frame = this.frameData(dt);
    this.background.frame(frame);
    this.style.frame(frame);
    this.stats.position = frame.position;
    const inset = this.style.inset();
    if (inset !== this.inset) {
      this.inset = inset;
      this.onInset?.(inset);
    }
    this.govern(performance.now() - begin, interval);
  };

  private frameData(dt: number): FrameData {
    const a = this.analysis;
    const s = this.settings;
    const timeline = this.timeline;
    const duration = timeline ? timeline.duration : 0;
    const position = Math.min(duration || Infinity, Math.max(0, this.clock.now()));
    return {
      time: (performance.now() - this.started) / 1000,
      dt,
      width: this.width,
      height: this.height,
      frequency: a.frequency,
      waveform: a.waveform,
      binHz: a.binHz,
      bands: a.bands,
      bass: a.bass,
      mid: a.mid,
      treble: a.treble,
      level: a.level,
      beat: a.beat,
      pulse: a.pulse,
      position,
      duration,
      playing: this.clock.playing,
      timeline,
      theme: s.theme,
      motion: s.motion,
      sensitivity: s.sensitivity,
      quality: this.quality,
      mirror: s.mirror,
      layered: s.layered,
      image: this.image,
    };
  }

  /** Watch the frame cost and step the quality down when it stays over budget */
  private govern(cost: number, interval: number): void {
    const st = this.stats;
    st.frames++;
    st.frameMs += (cost - st.frameMs) * 0.05;
    if (interval < 250) st.intervalMs += (interval - st.intervalMs) * 0.05;
    if (++this.settled < SETTLE_FRAMES) return;
    if (st.frameMs <= BUDGET_MS && st.intervalMs <= SLOW_INTERVAL_MS) return;
    const next = QUALITIES[QUALITIES.indexOf(this.quality) + 1];
    if (!next) return;
    this.quality = next;
    st.quality = next;
    this.settled = 0;
    this.resize(this.width, this.height);
  }

  private resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.background.resize(this.surfaceSize(this.settings.background));
    this.style.resize(this.surfaceSize(this.settings.style));
  }

  private surfaceSize(kind: LayerKind): Omit<Surface, 'canvas'> {
    const ratio = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO[this.quality]);
    return { width: this.width, height: this.height, scale: ratio * (kind.resolution ?? 1) };
  }
}

/** One canvas and the layer drawing on it. Switching layers swaps in a fresh canvas, since a canvas keeps its first context type. */
class Slot {
  private readonly className: string;
  private canvas: HTMLCanvasElement;
  private layer: Layer | null = null;

  constructor(host: HTMLElement, className: string) {
    this.className = className;
    this.canvas = this.fresh();
    host.append(this.canvas);
  }

  set(kind: LayerKind, size: Omit<Surface, 'canvas'>): void {
    this.layer?.dispose();
    this.layer = null;
    for (const create of [kind.create, kind.fallback]) {
      if (!create) continue;
      const canvas = this.fresh();
      this.canvas.replaceWith(canvas);
      this.canvas = canvas;
      const layer = create();
      if (layer.init(this.surface(size))) {
        this.layer = layer;
        return;
      }
      layer.dispose();
    }
  }

  resize(size: Omit<Surface, 'canvas'>): void {
    this.layer?.resize(this.surface(size));
  }

  frame(frame: FrameData): void {
    this.layer?.frame(frame);
  }

  inset(): number {
    return this.layer?.inset?.() ?? 0;
  }

  dispose(): void {
    this.layer?.dispose();
    this.layer = null;
    this.canvas.remove();
  }

  /** Size the canvas's backing store and describe it */
  private surface({ width, height, scale }: Omit<Surface, 'canvas'>): Surface {
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    return { canvas: this.canvas, width, height, scale: w / Math.max(1, width) };
  }

  private fresh(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.className = this.className;
    canvas.setAttribute('aria-hidden', 'true');
    return canvas;
  }
}

/** Phones and small machines start one step down */
function initialQuality(): Quality {
  if ((navigator.hardwareConcurrency ?? 8) <= 2) return 'low';
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  return small && window.matchMedia('(pointer: coarse)').matches ? 'medium' : 'high';
}
