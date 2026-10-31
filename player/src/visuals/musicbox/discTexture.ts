// The disc's face as a texture in its own coordinates (the top view: x to the right, z down the canvas): red is every perforation
// (the song's slots, the drive holes round the rim and the spindle hole), green is the tune's slots, blue is what is printed on the
// steel (the label's rules and the song's title). Drawn once per song.

import { CanvasTexture, LinearMipmapLinearFilter, NoColorSpace } from 'three';
import { DISC_RADIUS, DRIVE_HOLES, DRIVE_RING, LABEL, discPoint, type DiscLayout } from './layout.ts';

export interface DiscPrint {
  title: string;
  /** A CSS font family for the title, loaded already */
  font: string;
}

/** `size`: pixels across the texture (the whole disc); `anisotropy`: the filtering the renderer allows */
export function discTexture(layout: DiscLayout, print: DiscPrint, size: number, anisotropy: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  // Opaque black, then each channel added on its own ('lighter' keeps them apart and lets overlapping holes merge)
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'lighter';
  const scale = size / (2 * DISC_RADIUS);
  g.setTransform(scale, 0, 0, scale, size / 2, size / 2);

  const { holeWidth: w } = layout;
  for (const s of layout.slots) {
    const radius = layout.rows[s.row].radius;
    // Its leading edge at its angle, the slot trailing behind along the track
    const middle = s.angle + s.length / 2 / radius;
    slotAt(g, middle, radius, s.length, w, '#ff0000');
    if (s.lead) slotAt(g, middle, radius, s.length, w, '#00ff00');
  }
  for (let i = 0; i < DRIVE_HOLES; i++) slotAt(g, (i / DRIVE_HOLES) * Math.PI * 2, DRIVE_RING * DISC_RADIUS, 0.0034, 0.0024, '#ff0000');
  g.fillStyle = '#ff0000';
  g.beginPath();
  g.arc(0, 0, 0.0062, 0, Math.PI * 2);
  g.fill();

  // Print: the label's double rule, a hairline round the tracks and one outside them, a start mark at the rim, and the title
  g.strokeStyle = '#0000ff';
  g.lineWidth = 0.00045;
  for (const r of [LABEL, LABEL - 0.012, 0.912, 0.36]) {
    g.beginPath();
    g.arc(0, 0, r * DISC_RADIUS, 0, Math.PI * 2);
    g.stroke();
  }
  g.lineWidth = 0.0009;
  const [x0, z0] = discPoint(0, 0.915 * DISC_RADIUS);
  const [x1, z1] = discPoint(0, 0.985 * DISC_RADIUS);
  g.beginPath();
  g.moveTo(x0, z0);
  g.lineTo(x1, z1);
  g.stroke();
  arcText(g, print.title, (LABEL - 0.058) * DISC_RADIUS, 0.0105, print.font);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = NoColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = anisotropy;
  return texture;
}

/** A punched slot: a rectangle with softened corners, centred at `angle` on a track and lying along it */
function slotAt(g: CanvasRenderingContext2D, angle: number, radius: number, length: number, width: number, color: string): void {
  const [x, z] = discPoint(angle, radius);
  g.save();
  g.translate(x, z);
  // The track's direction at this angle is (cos, -sin) on the canvas
  g.rotate(-angle);
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(-length / 2, -width / 2, length, width, width * 0.22);
  g.fill();
  g.restore();
}

/** Text set round an arc, reading clockwise, centred on the far side of the label from the comb */
function arcText(g: CanvasRenderingContext2D, text: string, radius: number, size: number, font: string): void {
  // Canvas fonts misbehave at sub-pixel sizes: draw at 100 units and scale down
  const k = size / 100;
  g.save();
  g.fillStyle = '#0000ff';
  g.font = `italic 100px ${font}`;
  g.textBaseline = 'alphabetic';
  const glyphs = [...text];
  const widths = glyphs.map((c) => g.measureText(c).width * k);
  const total = widths.reduce((a, b) => a + b, 0);
  let a = -Math.PI / 2 - total / 2 / radius;
  for (const [i, c] of glyphs.entries()) {
    g.save();
    g.rotate(a + widths[i] / 2 / radius + Math.PI / 2);
    g.translate(0, -radius);
    g.scale(k, k);
    g.fillText(c, -widths[i] / 2 / k, 0);
    g.restore();
    a += widths[i] / radius;
  }
  g.restore();
}
