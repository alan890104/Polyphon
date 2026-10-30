// Particles: a field of fine hairline streaks drifting on a slow current, in three depths, each drawn along its motion so the
// field shows the flow like iron filings. Beats push the field outward from the centre and it springs back (with a faint ring for
// the strongest), so it breathes with the music without thinning out; the treble makes the far layer shimmer.

import { Layer2D } from '../layer2d.ts';
import { alpha } from '../themes.ts';
import type { FrameData, LayerKind } from '../types.ts';

/** Particles for a 1440 × 900 screen at each quality (scaled with the area) */
const COUNT: Record<FrameData['quality'], number> = { high: 2400, medium: 1600, low: 800 };
/** Depth layers: share of the particles, line width (px), opacity */
const DEPTHS = [
  { share: 0.5, width: 0.75, opacity: 0.4 },
  { share: 0.35, width: 1, opacity: 0.65 },
  { share: 0.15, width: 1.4, opacity: 0.9 },
] as const;
/** Every so many particles is brass */
const ACCENT_EVERY = 13;
/** Seconds of motion each streak shows: of the drift, and (much less) of a burst, which would otherwise streak like warp speed */
const TRAIL = 0.32;
const BURST_TRAIL = 0.06;

interface Ring {
  radius: number;
  strength: number;
}

class Particles extends Layer2D {
  private count = 0;
  /** Where the current carries each particle */
  private x = new Float32Array(0);
  private y = new Float32Array(0);
  /** How far beats have pushed it from there, and how fast that is changing (a damped spring pulls it back) */
  private ox = new Float32Array(0);
  private oy = new Float32Array(0);
  private vx = new Float32Array(0);
  private vy = new Float32Array(0);
  /** The streak behind each particle this frame */
  private mx = new Float32Array(0);
  private my = new Float32Array(0);
  /** 0-1: how near the particle is (near ones move more) */
  private z = new Float32Array(0);
  private rings: Ring[] = [];
  private quality: FrameData['quality'] | null = null;

  protected layout(): void {
    this.quality = null;
  }

  frame(f: FrameData): void {
    const { g, width, height } = this;
    if (this.quality !== f.quality) this.seed(f.quality);
    g.clearRect(0, 0, width, height);
    this.move(f);
    this.drawRings(f);

    const theme = f.theme;
    let from = 0;
    g.lineCap = 'round';
    DEPTHS.forEach((depth, d) => {
      const to = d === DEPTHS.length - 1 ? this.count : from + Math.round(this.count * depth.share);
      const shimmer = d === 0 ? 0.65 + f.treble * 0.7 : 1;
      const lift = 0.8 + f.level * 0.3;
      g.lineWidth = depth.width;
      this.drawDepth(from, to, alpha(theme.paper, depth.opacity * shimmer * lift), false);
      this.drawDepth(from, to, alpha(theme.accent, Math.min(1, depth.opacity * 1.15 * lift)), true);
      from = to;
    });
  }

  private seed(quality: FrameData['quality']): void {
    this.quality = quality;
    const area = (this.width * this.height) / (1440 * 900);
    const n = Math.max(300, Math.round(COUNT[quality] * Math.min(1.4, area)));
    this.count = n;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.ox = new Float32Array(n);
    this.oy = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.mx = new Float32Array(n);
    this.my = new Float32Array(n);
    this.z = new Float32Array(n);
    let from = 0;
    DEPTHS.forEach((depth, d) => {
      const to = d === DEPTHS.length - 1 ? n : from + Math.round(n * depth.share);
      for (let i = from; i < to; i++) {
        this.x[i] = Math.random() * this.width;
        this.y[i] = Math.random() * this.height;
        this.z[i] = 0.35 + d * 0.28 + Math.random() * 0.15;
      }
      from = to;
    });
  }

  /** Drift on a slow current (a sum of sines: cheap and smooth), wrap at the edges, and let beats push the field outward */
  private move(f: FrameData): void {
    const { width, height } = this;
    const cx = width / 2;
    const cy = height / 2;
    const t = f.time;
    const dt = f.dt;
    const drift = (14 + f.level * 40 * f.motion) * (0.5 + f.motion * 0.7);
    const push = f.beat ? (90 + f.pulse * 260) * f.motion : 0;
    // A damped spring: about a third of a second out and back
    const stiffness = 26;
    const damping = Math.exp(-dt * 7);
    if (f.beat && f.motion > 0.05 && f.pulse > 0.7) this.rings.push({ radius: Math.min(width, height) * 0.04, strength: f.pulse });
    for (let i = 0; i < this.count; i++) {
      let x = this.x[i];
      let y = this.y[i];
      const z = this.z[i];
      const angle = Math.sin(x * 0.0019 + t * 0.06) * 1.6 + Math.cos(y * 0.0024 - t * 0.045) * 1.6 + Math.sin((x + y) * 0.0011 + t * 0.03);
      const fx = Math.cos(angle) * drift * z;
      const fy = Math.sin(angle) * drift * z;
      x += fx * dt;
      y += fy * dt;
      if (x < -8) x += width + 16;
      else if (x > width + 8) x -= width + 16;
      if (y < -8) y += height + 16;
      else if (y > height + 8) y -= height + 16;
      this.x[i] = x;
      this.y[i] = y;
      let vx = this.vx[i];
      let vy = this.vy[i];
      if (push) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy) + 60;
        // Strongest near the centre, so the burst reads as coming from it
        const k = (push * z * Math.min(1, 280 / d)) / d;
        vx += dx * k;
        vy += dy * k;
      }
      vx = (vx - this.ox[i] * stiffness * dt) * damping;
      vy = (vy - this.oy[i] * stiffness * dt) * damping;
      this.ox[i] += vx * dt;
      this.oy[i] += vy * dt;
      this.vx[i] = vx;
      this.vy[i] = vy;
      this.mx[i] = fx * TRAIL + vx * BURST_TRAIL;
      this.my[i] = fy * TRAIL + vy * BURST_TRAIL;
    }
  }

  /** One depth's particles in one stroke: each a short line back along its motion */
  private drawDepth(from: number, to: number, color: string, accent: boolean): void {
    const { g } = this;
    g.strokeStyle = color;
    g.beginPath();
    for (let i = from; i < to; i++) {
      if ((i % ACCENT_EVERY === 0) !== accent) continue;
      const x = this.x[i] + this.ox[i];
      const y = this.y[i] + this.oy[i];
      g.moveTo(x, y);
      g.lineTo(x - this.mx[i] - 0.01, y - this.my[i]);
    }
    g.stroke();
  }

  /** A hairline ring spreading from the centre on strong beats */
  private drawRings(f: FrameData): void {
    const { g } = this;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const max = Math.hypot(cx, cy);
    this.rings = this.rings.filter((ring) => {
      ring.radius += f.dt * (220 + ring.radius * 1.3);
      const life = 1 - ring.radius / max;
      if (life <= 0) return false;
      g.strokeStyle = alpha(f.theme.accent, life * life * 0.35 * ring.strength);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy, ring.radius, 0, Math.PI * 2);
      g.stroke();
      return true;
    });
    if (this.rings.length > 4) this.rings.shift();
  }
}

export const particles: LayerKind<'particles'> = {
  id: 'particles',
  name: 'Particles',
  description: 'A drifting field of hairlines that bursts on the beat',
  create: () => new Particles(),
};
