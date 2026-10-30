// Aurora: slow curtains of colour flowing over the ink, drawn by a shader at low resolution (it is soft by nature); the bass
// brightens it and the level speeds it up a little. Without WebGL, a few drifting gradients stand in for it.

import { shaderProgram, type ShaderProgram } from '../gl.ts';
import { Layer2D } from '../layer2d.ts';
import { alpha, rgbOf } from '../themes.ts';
import type { FrameData, Layer, LayerKind, Surface } from '../types.ts';

const FRAGMENT = `
precision mediump float;
uniform vec2 size;
uniform float time;
uniform float bass;
uniform float level;
uniform vec3 ink;
uniform vec3 c1;
uniform vec3 c2;
uniform vec3 c3;
varying vec2 uv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = vec2(uv.x * size.x / size.y, uv.y);
  float t = time;
  vec2 q = vec2(fbm(p * 1.1 + vec2(t, -t * 0.6)), fbm(p * 1.3 + vec2(-t * 0.8, t * 0.5) + 4.0));
  float n = fbm(p * 1.5 + q * 1.9 + vec2(0.0, t * 1.3));
  // Curtains: a band across the upper half that sways, with vertical folds
  float sway = 0.6 + 0.1 * sin(p.x * 1.4 + t * 2.6) + 0.05 * sin(p.x * 3.1 - t * 1.7);
  float band = exp(-pow((uv.y - sway) * 2.4, 2.0));
  float folds = 0.65 + 0.35 * sin(p.x * 9.0 + q.y * 6.0 + t * 2.0);
  vec3 colour = mix(c1, c2, smoothstep(0.3, 0.7, q.x));
  colour = mix(colour, c3, smoothstep(0.4, 0.8, n));
  float glow = (0.25 + 0.75 * band * folds) * smoothstep(0.2, 0.8, n);
  vec3 outColour = ink + colour * glow * (0.75 + bass * 0.7 + level * 0.25);
  float edge = length((uv - 0.5) * vec2(1.0, 1.25));
  outColour = mix(outColour, ink * 0.8, smoothstep(0.35, 0.85, edge));
  outColour += (hash(gl_FragCoord.xy + fract(time)) - 0.5) / 160.0;
  gl_FragColor = vec4(outColour, 1.0);
}`;

class ShaderAurora implements Layer {
  private shader: ShaderProgram | null = null;
  private width = 1;
  private height = 1;
  private clock = 0;

  init(surface: Surface): boolean {
    this.shader = shaderProgram(surface.canvas, FRAGMENT);
    this.resize(surface);
    return this.shader !== null;
  }

  resize({ width, height }: Surface): void {
    this.width = width;
    this.height = height;
  }

  frame(f: FrameData): void {
    const s = this.shader;
    if (!s) return;
    const { gl } = s;
    this.clock += f.dt * (0.025 + f.level * 0.03 * f.motion) * (0.4 + f.motion);
    gl.uniform2f(s.uniform('size'), this.width, this.height);
    gl.uniform1f(s.uniform('time'), this.clock + 7);
    gl.uniform1f(s.uniform('bass'), f.bass);
    gl.uniform1f(s.uniform('level'), f.level);
    gl.uniform3fv(s.uniform('ink'), rgbOf(f.theme.ink));
    gl.uniform3fv(s.uniform('c1'), rgbOf(f.theme.aurora[0]));
    gl.uniform3fv(s.uniform('c2'), rgbOf(f.theme.aurora[1]));
    gl.uniform3fv(s.uniform('c3'), rgbOf(f.theme.aurora[2]));
    s.draw();
  }

  dispose(): void {
    this.shader?.dispose();
    this.shader = null;
  }
}

/** Without WebGL: three soft gradients drifting on slow loops */
class CanvasAurora extends Layer2D {
  private clock = 0;

  frame(f: FrameData): void {
    const { g, width, height } = this;
    this.clock += f.dt * (0.05 + f.level * 0.05 * f.motion);
    const t = this.clock;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = f.theme.ink;
    g.fillRect(0, 0, width, height);
    g.globalCompositeOperation = 'lighter';
    const r = Math.max(width, height) * 0.55;
    f.theme.aurora.forEach((colour, i) => {
      const x = width * (0.5 + 0.35 * Math.sin(t * (0.7 + i * 0.23) + i * 2.1));
      const y = height * (0.42 + 0.18 * Math.cos(t * (0.5 + i * 0.17) + i * 1.3));
      const glow = g.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, alpha(colour, 0.55 + f.bass * 0.35));
      glow.addColorStop(1, alpha(colour, 0));
      g.fillStyle = glow;
      g.fillRect(0, 0, width, height);
    });
    g.globalCompositeOperation = 'source-over';
  }
}

export const aurora: LayerKind<'aurora'> = {
  id: 'aurora',
  name: 'Aurora',
  description: 'Slow curtains of colour that brighten with the bass',
  resolution: 0.33,
  create: () => new ShaderAurora(),
  fallback: () => new CanvasAurora(),
};
