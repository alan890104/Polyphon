// The music box: a disc music box in a lamplit room, playing the song in 3D. The disc makes one turn per pass of the song under the
// comb, each perforation plucks its tooth as its note sounds, and a lamp under the comb throws the notes onto the lid. The scene
// (three.js, in ../musicbox) is fetched only when this style is shown; without WebGL 2 the circular disc stands in for it.

import type { Song } from 'polyphon';
import type { Budget, MusicBox } from '../musicbox/MusicBox.ts';
import { prefersReducedMotion } from '../settings.ts';
import type { FrameData, Layer, LayerKind, Quality, Surface } from '../types.ts';
import { circular } from './circular.ts';

/** What each quality spends: the scene's multisampling, and the disc's texture */
const BUDGETS: Record<Quality, Budget> = {
  high: { samples: 4, discSize: 2048 },
  medium: { samples: 2, discSize: 2048 },
  low: { samples: 0, discSize: 1024 },
};
/** The settings' default motion moves the camera the whole way; less shortens its travel */
const FULL_MOTION = 0.7;

class MusicBoxStyle implements Layer {
  readonly opaque = true;
  private box: MusicBox | null = null;
  private surface: Surface | null = null;
  private quality: Quality | null = null;
  /** The song on the disc (undefined until the first frame) */
  private song: Song | null | undefined;
  private disposed = false;

  init(surface: Surface): boolean {
    // The scene is lit in linear HDR, which needs float colour buffers
    const context = surface.canvas.getContext('webgl2', { alpha: false, antialias: false, stencil: false, powerPreference: 'high-performance' });
    if (!context?.getExtension('EXT_color_buffer_float')) return false;
    this.surface = surface;
    this.load(surface.canvas, context).catch(() => {
      // Offline before its code arrived, or a driver refused a shader: the stage stays dark and the controls still work
    });
    return true;
  }

  resize(surface: Surface): void {
    this.surface = surface;
    this.box?.setSize(surface.canvas.width, surface.canvas.height);
  }

  frame(f: FrameData): void {
    const box = this.box;
    if (!box) return;
    if (f.quality !== this.quality) {
      this.quality = f.quality;
      box.setBudget(BUDGETS[f.quality]);
    }
    const song = f.timeline?.song ?? null;
    if (song !== this.song) {
      this.song = song;
      void box.setSong(song);
    }
    box.draw(f.position, { dt: f.dt, motion: Math.min(1, f.motion / FULL_MOTION) });
  }

  dispose(): void {
    this.disposed = true;
    this.box?.dispose();
    this.box = null;
  }

  private async load(canvas: HTMLCanvasElement, context: WebGL2RenderingContext): Promise<void> {
    const { MusicBox } = await import('../musicbox/MusicBox.ts');
    const box = await MusicBox.create(canvas, { context, reducedMotion: prefersReducedMotion(), font: serifFont() });
    if (this.disposed) return box.dispose();
    this.box = box;
    if (this.surface) this.resize(this.surface);
  }
}

/** The house serif, for the title printed on the disc */
function serifFont(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--serif').trim() || '"Instrument Serif", serif';
}

export const musicBox: LayerKind<'musicbox'> = {
  id: 'musicbox',
  name: 'Music box',
  description: 'A disc music box playing the song, its lid lit by the notes',
  maxScale: 1.25,
  create: () => new MusicBoxStyle(),
  fallback: circular.create,
};
