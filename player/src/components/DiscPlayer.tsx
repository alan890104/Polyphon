// The Now playing disc: the song's disc turns under a fixed comb at 12 o'clock, and each perforation lights up in brass as it
// passes the comb, the way a polyphon plays its disc. The comb brightens a little with the music's level.

import { useEffect, useMemo, useRef } from 'react';
import { context2d, discCanvas, drawComb, drawHole, forEachLit, geometry, holesAt, palette, turnAt, type Disc, type Palette, type Perforation } from '../disc.ts';
import { useAnimationFrame } from '../useAnimationFrame.ts';
import { usePlayer } from '../usePlayer.ts';

/** Seconds a perforation stays lit after it passes the comb */
const AFTERGLOW = 2.5;
/** Room around the disc for the comb's pointer, as a fraction of the radius */
const INSET = 0.07;
/** How much of its level the comb keeps from one frame to the next */
const LEVEL_FALL = 0.9;

interface DiscPlayerProps {
  disc: Disc;
  /** Seconds for one turn */
  duration: number;
  analyser: AnalyserNode | null;
}

export function DiscPlayer({ disc, duration, analyser }: DiscPlayerProps) {
  const player = usePlayer();
  const canvas = useRef<HTMLCanvasElement>(null);
  /** The disc drawn once at the canvas's size; each frame turns it */
  const still = useRef<HTMLCanvasElement | null>(null);
  const shown = useRef({ turn: -1, level: -1 });
  const level = useRef(0);
  const samples = useMemo(() => new Float32Array(analyser?.fftSize ?? 0), [analyser]);
  const colors = useMemo(palette, []);
  const holes = holesAt(disc, 'large');

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const pixels = Math.round(entry.contentRect.width * devicePixelRatio);
      element.width = element.height = pixels;
      still.current = discCanvas(disc, 'large', pixels, colors, INSET);
      shown.current.turn = -1;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [disc, colors]);

  useAnimationFrame(() => {
    const element = canvas.current;
    if (!element || !still.current) return;
    level.current = Math.max(loudness(analyser, samples), level.current * LEVEL_FALL);
    const turn = turnAt(player.state.position, duration);
    if (turn === shown.current.turn && Math.abs(level.current - shown.current.level) < 0.01) return;
    shown.current = { turn, level: level.current };
    paint(context2d(element), still.current, holes, turn, AFTERGLOW / duration, level.current, colors);
  });

  return <canvas ref={canvas} className="disc-player" aria-hidden="true" />;
}

function paint(g: CanvasRenderingContext2D, still: HTMLCanvasElement, holes: readonly Perforation[], turn: number, afterglow: number, level: number, colors: Palette): void {
  const geo = geometry(still.width, 'large', INSET);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.clearRect(0, 0, still.width, still.height);
  g.translate(geo.center, geo.center);
  g.rotate(turn * Math.PI * 2);
  g.translate(-geo.center, -geo.center);
  g.drawImage(still, 0, 0);
  // The perforations that passed the comb a moment ago, fading as they move on
  g.shadowColor = colors.lit;
  g.shadowBlur = geo.hole * 2;
  forEachLit(holes, turn, afterglow, (hole, glow) => drawHole(g, hole, geo, colors.lit, glow ** 0.7, 1.3));
  g.shadowBlur = 0;
  g.setTransform(1, 0, 0, 1, 0, 0);
  drawComb(g, geo, colors.brass, 0.5 + 0.5 * level);
}

/** The music's level, 0-1, from the analyser's waveform */
function loudness(analyser: AnalyserNode | null, samples: Float32Array<ArrayBuffer>): number {
  if (!analyser) return 0;
  analyser.getFloatTimeDomainData(samples);
  let sum = 0;
  for (const x of samples) sum += x * x;
  return Math.min(1, Math.sqrt(sum / samples.length) * 6);
}
