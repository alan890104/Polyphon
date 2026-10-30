// The base of every Canvas 2D layer: it takes the context, keeps the size in CSS pixels and scales drawing to the backing store.

import type { FrameData, Layer, Surface } from './types.ts';

export abstract class Layer2D implements Layer {
  protected g!: CanvasRenderingContext2D;
  /** CSS pixels */
  protected width = 0;
  protected height = 0;
  /** Backing-store pixels per CSS pixel */
  protected scale = 1;

  init(surface: Surface): boolean {
    const g = surface.canvas.getContext('2d');
    if (!g) return false;
    this.g = g;
    this.resize(surface);
    return true;
  }

  resize({ width, height, scale }: Surface): void {
    this.width = width;
    this.height = height;
    this.scale = scale;
    this.g.setTransform(scale, 0, 0, scale, 0, 0);
    this.layout();
  }

  abstract frame(frame: FrameData): void;

  dispose(): void {}

  /** Called after every resize: recompute anything that depends on the size */
  protected layout(): void {}
}
