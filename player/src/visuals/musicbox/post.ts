// The finishing chain, run on the scene's linear HDR image:
//   scene (multisampled, half float, with depth) -> half-size copy with the circle of confusion in alpha
//   -> background blur at half size (a 24-tap gather that ignores sharper pixels, so nothing in focus bleeds into the blur)
//   -> a small bloom (threshold, four halvings down and back up) for the glints and the lantern's flares, its input clamped so no
//      single highlight can flood it
//   -> to the screen: sharp and blurred mixed by depth, bloom added, a soft vignette, filmic tone mapping, a dither.
// Everything after the scene runs at half size or less except the last pass.

import {
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

export interface PostSettings {
  /** Distance in focus (metres) */
  focus: number;
  /** Seed for the dither, so frames differ from each other but repeat exactly */
  frame: number;
}

/** How quickly things soften away from the focus */
const APERTURE = 0.22;
const BLOOM = 0.24;
/** Linear brightness where bloom begins, and the most any pixel adds to it */
const BLOOM_THRESHOLD = 3.2;
const BLOOM_CLAMP = 12;
const BLOOM_LEVELS = 4;

export class Post {
  private readonly renderer: WebGLRenderer;
  private readonly scene: WebGLRenderTarget;
  private readonly half: WebGLRenderTarget;
  private readonly blurred: WebGLRenderTarget;
  private readonly down: WebGLRenderTarget[] = [];
  private readonly up: WebGLRenderTarget[] = [];
  private readonly quad = new FullScreenQuad();
  private readonly prepare = pass(PREPARE);
  private readonly gather = pass(GATHER);
  private readonly bright = pass(BRIGHT);
  private readonly downsample = pass(DOWNSAMPLE);
  private readonly upsample = pass(UPSAMPLE);
  private readonly finish = pass(FINISH, true);
  /** Texel sizes, one per target read from, kept rather than made anew every frame */
  private readonly texels = new Map<WebGLRenderTarget, Vector2>();

  /** `samples`: the scene's multisampling (0 for none) */
  constructor(renderer: WebGLRenderer, samples: number) {
    this.renderer = renderer;
    const hdr = { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false };
    this.scene = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples, depthTexture: new DepthTexture(1, 1) });
    this.half = new WebGLRenderTarget(1, 1, hdr);
    this.blurred = new WebGLRenderTarget(1, 1, hdr);
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      this.down.push(new WebGLRenderTarget(1, 1, hdr));
      if (i < BLOOM_LEVELS - 1) this.up.push(new WebGLRenderTarget(1, 1, hdr));
    }
  }

  /** Size in device pixels */
  setSize(width: number, height: number): void {
    this.scene.setSize(width, height);
    const hw = Math.max(1, width >> 1);
    const hh = Math.max(1, height >> 1);
    this.half.setSize(hw, hh);
    this.blurred.setSize(hw, hh);
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      const w = Math.max(1, width >> (i + 2));
      const h = Math.max(1, height >> (i + 2));
      this.down[i].setSize(w, h);
      if (i < BLOOM_LEVELS - 1) this.up[i].setSize(w, h);
    }
  }

  setSamples(samples: number): void {
    if (samples === this.scene.samples) return;
    this.scene.samples = samples;
    // Made again at the next render
    this.scene.dispose();
  }

  render(scene: Scene, camera: PerspectiveCamera, settings: PostSettings): void {
    const r = this.renderer;
    r.setRenderTarget(this.scene);
    r.render(scene, camera);

    const depth = this.scene.depthTexture!;
    const lens = { near: camera.near, far: camera.far, focus: settings.focus, aperture: APERTURE };
    // Blur radius: a fraction of the screen's height, the same look at any resolution
    const radius = 0.03 * this.half.height;

    this.run(this.prepare, this.half, { tColor: this.scene.texture, tDepth: depth, uTexel: this.texelOf(this.scene), ...uniformsOf(lens) });
    this.run(this.gather, this.blurred, { tHalf: this.half.texture, uTexel: this.texelOf(this.half), uRadius: radius });

    // Bloom: bright parts, halved four times, then added back up
    this.run(this.bright, this.down[0], { tHalf: this.half.texture, uTexel: this.texelOf(this.half), uThreshold: BLOOM_THRESHOLD, uClamp: BLOOM_CLAMP });
    for (let i = 1; i < BLOOM_LEVELS; i++) this.run(this.downsample, this.down[i], { tSource: this.down[i - 1].texture, uTexel: this.texelOf(this.down[i - 1]) });
    let source: Texture = this.down[BLOOM_LEVELS - 1].texture;
    let sourceTarget = this.down[BLOOM_LEVELS - 1];
    for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
      this.run(this.upsample, this.up[i], { tSource: source, tAdd: this.down[i].texture, uTexel: this.texelOf(sourceTarget) });
      source = this.up[i].texture;
      sourceTarget = this.up[i];
    }

    this.run(this.finish, null, {
      tColor: this.scene.texture,
      tBlurred: this.blurred.texture,
      tBloom: source,
      tDepth: depth,
      uBloom: BLOOM,
      uSeed: (settings.frame % 997) * 0.618,
      uAspect: this.scene.width / Math.max(1, this.scene.height),
      ...uniformsOf(lens),
    });
  }

  dispose(): void {
    for (const t of [this.scene, this.half, this.blurred, ...this.down, ...this.up]) t.dispose();
    for (const m of [this.prepare, this.gather, this.bright, this.downsample, this.upsample, this.finish]) m.dispose();
    this.quad.dispose();
  }

  private texelOf(target: WebGLRenderTarget): Vector2 {
    let texel = this.texels.get(target);
    if (!texel) this.texels.set(target, (texel = new Vector2()));
    return texel.set(1 / target.width, 1 / target.height);
  }

  private run(material: ShaderMaterial, target: WebGLRenderTarget | null, uniforms: Record<string, unknown>): void {
    for (const [name, value] of Object.entries(uniforms)) {
      if (!material.uniforms[name]) material.uniforms[name] = { value };
      else material.uniforms[name].value = value;
    }
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.quad.render(this.renderer);
  }
}

function uniformsOf(lens: { near: number; far: number; focus: number; aperture: number }) {
  return { uNear: lens.near, uFar: lens.far, uFocus: lens.focus, uAperture: lens.aperture };
}

function pass(fragmentShader: string, toScreen = false): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {},
    vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    // Only the last pass is tone mapped (three adds its tone mapping and output colour space when drawing to the screen)
    toneMapped: toScreen,
  });
}

const COC = /* glsl */ `
#include <packing>
uniform sampler2D tDepth;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uAperture;
// Signed circle of confusion, -1 (near) to 1 (far), 0 in focus
float cocAt(vec2 uv) {
  float z = -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar);
  return clamp(uAperture * (z - uFocus) / z, -1.0, 1.0);
}
`;

const PREPARE = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tColor;
uniform vec2 uTexel;
${COC}
void main() {
  // Four taps: a soft half-size copy, with the blur each pixel wants in alpha
  vec3 c = texture2D(tColor, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(tColor, vUv + uTexel * vec2(0.5, -0.5)).rgb
         + texture2D(tColor, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(tColor, vUv + uTexel * vec2(0.5, 0.5)).rgb;
  gl_FragColor = vec4(min(c * 0.25, vec3(64.0)), abs(cocAt(vUv)));
}
`;

const GATHER = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tHalf;
uniform vec2 uTexel;
uniform float uRadius;
const int TAPS = 24;
void main() {
  vec4 center = texture2D(tHalf, vUv);
  float reach = center.a * uRadius;
  vec3 sum = center.rgb;
  float weight = 1.0;
  for (int i = 1; i < TAPS; i++) {
    // Golden-angle spiral, evenly covering the disc
    float k = float(i) / float(TAPS);
    float r = sqrt(k);
    float a = float(i) * 2.39996323;
    vec2 offset = vec2(cos(a), sin(a)) * r * reach;
    vec4 s = texture2D(tHalf, vUv + offset * uTexel);
    // A sample counts only if it is itself blurred enough to reach here: sharp things never smear into the blur
    float w = smoothstep(r * center.a - 0.15, r * center.a, s.a);
    sum += s.rgb * w;
    weight += w;
  }
  gl_FragColor = vec4(sum / weight, center.a);
}
`;

const BRIGHT = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tHalf;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uClamp;
void main() {
  vec3 c = vec3(0.0);
  c += texture2D(tHalf, vUv + uTexel * vec2(-0.5, -0.5)).rgb;
  c += texture2D(tHalf, vUv + uTexel * vec2(0.5, -0.5)).rgb;
  c += texture2D(tHalf, vUv + uTexel * vec2(-0.5, 0.5)).rgb;
  c += texture2D(tHalf, vUv + uTexel * vec2(0.5, 0.5)).rgb;
  c = min(c * 0.25, vec3(uClamp));
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // A soft knee above the threshold
  float over = max(luma - uThreshold, 0.0);
  gl_FragColor = vec4(c * (over * over / (over + 0.5)) / max(luma, 1e-4), 1.0);
}
`;

const DOWNSAMPLE = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tSource;
uniform vec2 uTexel;
void main() {
  vec3 c = texture2D(tSource, vUv).rgb * 4.0;
  c += texture2D(tSource, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tSource, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  c += texture2D(tSource, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  c += texture2D(tSource, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}
`;

const UPSAMPLE = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tSource;
uniform sampler2D tAdd;
uniform vec2 uTexel;
void main() {
  vec3 c = vec3(0.0);
  c += texture2D(tSource, vUv + uTexel * vec2(-1.0, 0.0)).rgb;
  c += texture2D(tSource, vUv + uTexel * vec2(1.0, 0.0)).rgb;
  c += texture2D(tSource, vUv + uTexel * vec2(0.0, -1.0)).rgb;
  c += texture2D(tSource, vUv + uTexel * vec2(0.0, 1.0)).rgb;
  c += texture2D(tSource, vUv + uTexel * vec2(-0.7, -0.7)).rgb;
  c += texture2D(tSource, vUv + uTexel * vec2(0.7, -0.7)).rgb;
  c += texture2D(tSource, vUv + uTexel * vec2(-0.7, 0.7)).rgb;
  c += texture2D(tSource, vUv + uTexel * vec2(0.7, 0.7)).rgb;
  gl_FragColor = vec4(c / 8.0 + texture2D(tAdd, vUv).rgb, 1.0);
}
`;

const FINISH = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tBlurred;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uSeed;
uniform float uAspect;
${COC}
float ditherHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec3 sharp = texture2D(tColor, vUv).rgb;
  vec3 soft = texture2D(tBlurred, vUv).rgb;
  float coc = abs(cocAt(vUv));
  vec3 color = mix(sharp, soft, smoothstep(0.02, 0.22, coc));
  color += texture2D(tBloom, vUv).rgb * uBloom;
  // A soft vignette, wider than tall
  vec2 q = (vUv - 0.5) * vec2(uAspect / 1.6, 1.0);
  color *= mix(1.0, 0.62, smoothstep(0.25, 0.85, dot(q, q) * 1.6));
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  // A gentle print-film S-curve on top of AgX, which is otherwise a little flat
  gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * gl_FragColor.rgb * (3.0 - 2.0 * gl_FragColor.rgb), 0.35);
  #include <colorspace_fragment>
  // A dither in the output's own steps, so the dark gradients never band
  float n = ditherHash(gl_FragCoord.xy + uSeed * 113.0) + ditherHash(gl_FragCoord.xy * 1.37 + uSeed * 71.0) - 1.0;
  gl_FragColor.rgb += n * (1.5 / 255.0);
}
`;
