// The lantern: a small lamp inside the case, under the comb, the way a music-box lantern throws stars on a nursery wall. Its light
// shows through the perforations around the comb, and a slit right under the comb makes each one flare as it passes (the moment
// its note sounds). On the paper inside the lid it throws the notes being played as round points of light: pitch is height, the
// tune burns brighter and larger than the accompaniment, and each point drifts to the left and dims within a second or two, so the
// lid shows what is sounding or has just sounded and nothing else: read from left to right, the last moments of the music.
//
// Everything is measured in time, not distance, so a disc that turns slowly (a long song) looks the same as a fast one.

import { Color, Vector2, Vector3, type WebGLProgramParametersWithUniforms } from 'three';
import { DISC_RADIUS, type Row } from './layout.ts';
import type { Plucks } from './plucks.ts';
import { patch } from './shaderPatch.ts';

/** Points of light on the lid at most (the brightest are kept) */
const SPOTS = 24;
/** Seconds a note stays on the lid at most */
const WINDOW = 2;
/** Seconds a point takes to fade to a third */
const FADE = 0.5;
/** A long note stays this bright while it sounds, then fades */
const HELD = 0.5;
/** How bright the accompaniment's points are beside the tune's */
const ACCOMPANIMENT = 0.55;
/** Where a point appears on the paper (across, 0-1), how fast it drifts away (paper widths a second), and its size */
const ONSET = 0.66;
const DRIFT = 0.13;
const SIZE = 0.0085;
/** The band of heights the pitches span on the paper (0 at the hinge, 1 at the top) */
const LOWEST = 0.06;
const HIGHEST = 0.42;

export class Lantern {
  /** Where the lamp is, and where it points (the middle of the lid) */
  private readonly position = new Vector3(0, -0.072, 0.37);
  private readonly target = new Vector3(0, 0.22, -0.36);

  readonly uniforms = {
    uLanternPos: { value: this.position },
    uLanternDir: { value: new Vector3() },
    /** cos of the outer and inner cone angles */
    uLanternCone: { value: new Vector2(Math.cos(0.62), Math.cos(0.3)) },
    /** A warm filament (about 2400 K), linear colour times intensity */
    uLanternColor: { value: new Color(1.0, 0.62, 0.32).multiplyScalar(9) },
    /** Radians per second the disc turns */
    uLanternSpeed: { value: 1 },
    /** The points on the lid: across and up the paper (0-1), radius (a fraction of its width), brightness */
    uLanternSpots: { value: new Float32Array(SPOTS * 4) },
  };

  /** The points being collected for this frame, before the brightest are written to the uniform */
  private readonly brightness = new Float32Array(SPOTS);
  private count = 0;

  constructor() {
    this.uniforms.uLanternDir.value.subVectors(this.target, this.position).normalize();
  }

  /** `duration`: seconds one turn of the disc takes */
  setDuration(duration: number): void {
    this.uniforms.uLanternSpeed.value = (Math.PI * 2) / Math.max(1e-3, duration);
  }

  /** Throw the notes heard up to song time `t` onto the lid */
  update(plucks: Plucks, rows: readonly Row[], t: number): void {
    const spots = this.uniforms.uLanternSpots.value;
    spots.fill(0);
    this.brightness.fill(0);
    this.count = 0;
    plucks.forEachHeard(t, WINDOW, (row, since, velocity, hold, lead) => {
      const sounding = since < hold ? HELD : HELD * Math.exp(-(since - hold) / FADE);
      const light = (0.5 + 0.5 * velocity) * (lead ? 1 : ACCOMPANIMENT) * Math.max(Math.exp(-since / FADE), sounding);
      const slot = this.slotFor(light);
      if (slot < 0) return;
      spots[slot * 4] = ONSET - DRIFT * since;
      spots[slot * 4 + 1] = LOWEST + (HIGHEST - LOWEST) * rows[row].pitch;
      spots[slot * 4 + 2] = SIZE * (0.7 + 0.3 * velocity) * (lead ? 1.25 : 1);
      spots[slot * 4 + 3] = light;
    });
  }

  /** Let the paper inside the lid catch the thrown notes, and anything near it the glow round them */
  receive(shader: WebGLProgramParametersWithUniforms, spots: boolean): void {
    Object.assign(shader.uniforms, this.uniforms);
    shader.vertexShader = patch(shader.vertexShader, [
      ['#include <common>', '#include <common>\nvarying vec3 vLanternWorld;'],
      ['#include <fog_vertex>', '#include <fog_vertex>\nvLanternWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;'],
    ]);
    shader.fragmentShader = patch(shader.fragmentShader, [
      ['#include <common>', `#include <common>\n${LANTERN_GLSL}\n${THROWN_GLSL}`],
      [
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        reflectedLight.directDiffuse += lanternThrown(vLanternWorld, inverseTransformDirection(normal, viewMatrix), ${spots ? 'vUv' : 'vec2(-1.0)'})
          * BRDF_Lambert(material.diffuseColor);`,
      ],
    ]);
  }

  /** Where a point of this brightness goes: a free slot, the dimmest one if it is brighter, or -1 */
  private slotFor(light: number): number {
    if (light < 0.02) return -1;
    if (this.count < SPOTS) {
      this.brightness[this.count] = light;
      return this.count++;
    }
    let dimmest = 0;
    for (let i = 1; i < SPOTS; i++) if (this.brightness[i] < this.brightness[dimmest]) dimmest = i;
    if (this.brightness[dimmest] >= light) return -1;
    this.brightness[dimmest] = light;
    return dimmest;
  }
}

/** The lamp, shared by the disc (which shows it through its perforations) and what catches its thrown light */
export const LANTERN_GLSL = /* glsl */ `
varying vec3 vLanternWorld;
uniform vec3 uLanternPos;
uniform vec3 uLanternDir;
uniform vec2 uLanternCone;
uniform vec3 uLanternColor;
uniform float uLanternSpeed;

const float LANTERN_DISC_R = ${DISC_RADIUS.toFixed(4)};

float lanternCone(vec3 worldPos) {
  return smoothstep(uLanternCone.x, uLanternCone.y, dot(normalize(worldPos - uLanternPos), uLanternDir));
}
`;

/** On the disc: the lamp seen through the perforations near the comb, and the flare as each one passes the slit */
export const THROUGH_GLSL = /* glsl */ `
// Seconds until a point of the disc's plane (world x, z) reaches the comb's radius (+z): negative once it has passed
float lanternArrival(vec2 p) {
  return atan(p.x, p.y) / uLanternSpeed;
}

// The aperture under the comb: the tracks only, a sliver of what is coming and more of what has just played
float lanternGate(vec2 p) {
  float r = length(p) / LANTERN_DISC_R;
  float radial = smoothstep(0.355, 0.372, r) * (1.0 - smoothstep(0.9, 0.915, r));
  float a = atan(p.x, p.y);
  return radial * (a > 0.0 ? 1.0 - smoothstep(0.02, 0.08, a) : 1.0 - smoothstep(0.2, 0.5, -a));
}

// The slit right under the comb: each part of a perforation flares as it passes (its leading edge as the note sounds, the rest of
// a long slot while the note lasts) and fades in a few frames. Timed, so it neither starts early nor lingers on a slow disc.
float lanternSlit(vec2 p) {
  if (p.y <= 0.0) return 0.0;
  float t = lanternArrival(p);
  return (1.0 - smoothstep(0.0, 0.012, t)) * exp(-pow(min(t, 0.0) / 0.09, 2.0));
}

// The lamp's light coming up through a perforation at this point, seen from above
vec3 lanternThroughHole(vec3 worldPos) {
  float d = distance(worldPos, uLanternPos);
  float glow = lanternGate(worldPos.xz) * 0.016 * (0.35 + 0.65 * lanternCone(worldPos)) / d;
  return uLanternColor * (glow + 0.55 * lanternSlit(worldPos.xz));
}
`;

/** On the lid: the thrown points, and the faint glow of light escaping round the disc's rim, so the points read as thrown light */
const THROWN_GLSL = /* glsl */ `
uniform vec4 uLanternSpots[${SPOTS}];

// Round points with a crisp edge (softened only by the lamp's size), on the paper's own coordinates
float lanternSpots(vec2 uv) {
  float light = 0.0;
  for (int i = 0; i < ${SPOTS}; i++) {
    vec4 s = uLanternSpots[i];
    light += s.w * (1.0 - smoothstep(0.86, 1.0, length(uv - s.xy) / max(s.z, 1e-4)));
  }
  return light;
}

// Irradiance from the lantern at a point of the lid; uv is outside 0-1 where there is no paper
vec3 lanternThrown(vec3 worldPos, vec3 worldNormal, vec2 uv) {
  vec3 toLamp = uLanternPos - worldPos;
  float d2 = dot(toLamp, toLamp);
  float facing = max(dot(worldNormal, toLamp * inversesqrt(d2)), 0.0);
  float spots = uv.x >= 0.0 ? lanternSpots(uv) : 0.0;
  return uLanternColor * facing * (1.3 * spots + 0.012 * lanternCone(worldPos) / d2);
}
`;
