// A live spectrum over the cover: the analyser at the end of the audio chain, drawn as bars on a logarithmic frequency scale.

import { useEffect, useMemo, useRef } from 'react';
import { useAnimationFrame } from '../useAnimationFrame.ts';

const BARS = 40;
const LOW_HZ = 50;
const HIGH_HZ = 14000;
/** Part of each bar's slot left empty */
const GAP = 0.3;

export function Visualizer({ analyser }: { analyser: AnalyserNode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const bins = useMemo(() => new Uint8Array(analyser.frequencyBinCount), [analyser]);
  const bands = useMemo(() => bandBins(analyser), [analyser]);

  // Keep the drawing buffer at the element's size in device pixels
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      element.width = Math.round(entry.contentRect.width * devicePixelRatio);
      element.height = Math.round(entry.contentRect.height * devicePixelRatio);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useAnimationFrame(() => {
    const element = canvas.current;
    const g = element?.getContext('2d');
    if (!element || !g) return;
    analyser.getByteFrequencyData(bins);
    const { width, height } = element;
    const slot = width / BARS;
    const radius = (slot * (1 - GAP)) / 2;
    g.clearRect(0, 0, width, height);
    g.fillStyle = 'rgba(255, 255, 255, 0.88)';
    g.shadowColor = 'rgba(0, 0, 0, 0.35)';
    g.shadowBlur = radius;
    bands.forEach(([from, to], i) => {
      let peak = 0;
      for (let b = from; b < to; b++) peak = Math.max(peak, bins[b]);
      // Curved, so quiet bands stay low and loud ones stand out
      const h = (peak / 255) ** 1.6 * height;
      if (h < 1) return;
      g.beginPath();
      g.roundRect(i * slot + (slot * GAP) / 2, height - h, slot * (1 - GAP), h, [radius, radius, 0, 0]);
      g.fill();
    });
  });

  return <canvas ref={canvas} className="visualizer" aria-hidden="true" />;
}

/** The analyser bins [from, to) that make up each bar, spaced evenly in pitch */
function bandBins(analyser: AnalyserNode): [number, number][] {
  const hzPerBin = analyser.context.sampleRate / analyser.fftSize;
  const edge = (i: number) => Math.round((LOW_HZ * (HIGH_HZ / LOW_HZ) ** (i / BARS)) / hzPerBin);
  return Array.from({ length: BARS }, (_, i) => [edge(i), Math.max(edge(i) + 1, edge(i + 1))]);
}
