// The music box's materials, all physically based, with small shader patches where an object needs something the stock materials
// have no slot for: the disc's lathe brushing and perforations, the teeth bending and glinting, the lid catching the lantern.
// The physical material (clearcoat, sheen, anisotropy) only where it shows; the plain standard one everywhere else.

import { Color, DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial, type Texture } from 'three';
import { LANTERN_GLSL, THROUGH_GLSL, type Lantern } from './lantern.ts';
import { expand, patch } from './shaderPatch.ts';

export interface Textures {
  walnut: Texture;
  paper: Texture;
  mottle: Texture;
}

/** The disc's face texture (see discTexture.ts), swapped when the song changes */
export interface DiscFace {
  value: Texture | null;
}

/**
 * The disc: oiled steel turned on a lathe, so its fine grooves run round in circles and catch the light as a soft radial sheen,
 * with the song's perforations, its printed label, a little patina, and the lamp below showing through near the comb.
 */
export function discMaterial(lantern: Lantern, face: DiscFace): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    color: new Color(0.34, 0.33, 0.32),
    metalness: 1,
    roughness: 0.2,
    anisotropy: 0.3,
    envMapIntensity: 0.8,
  });
  material.defines = { USE_UV: '' };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, lantern.uniforms, { uDiscFace: face });
    shader.vertexShader = patch(shader.vertexShader, [
      ['#include <common>', '#include <common>\nvarying vec3 vLanternWorld;'],
      ['#include <fog_vertex>', '#include <fog_vertex>\nvLanternWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;'],
    ]);
    shader.fragmentShader = patch(expand(shader.fragmentShader, 'lights_physical_fragment'), [
      [
        '#include <common>',
        `#include <common>
        ${LANTERN_GLSL}
        ${THROUGH_GLSL}
        ${NOISE_GLSL}
        uniform sampler2D uDiscFace;
        vec4 discFace;
        float discWear;`,
      ],
      [
        '#include <map_fragment>',
        `#include <map_fragment>
        discFace = texture2D(uDiscFace, vUv);
        {
          float r = length(vUv - 0.5) * 2.0;
          // Patina: faint soft clouding, and the rim brightened by hands
          discWear = noise2(vUv * 22.0) * 0.4 + noise2(vUv * 70.0) * 0.35 + noise2(vUv * 240.0) * 0.25;
          diffuseColor.rgb *= mix(0.965, 1.015, discWear) * (1.0 + smoothstep(0.955, 0.995, r) * 0.06);
          // The turning tool's fine grooves, faded out where they would alias
          float ringFreq = 2600.0;
          float ringFade = 1.0 - smoothstep(0.15, 0.5, fwidth(r * ringFreq));
          discWear += sin(r * ringFreq + noise2(vec2(r * 40.0, 0.5)) * 6.0) * 0.25 * ringFade;
          // Printed in a warm black ink; through a perforation, the dark inside of the case
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.028, 0.022), discFace.b * 0.9);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012, 0.008, 0.006), discFace.r);
        }`,
      ],
      [
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (discWear - 0.5) * 0.03, 0.08, 1.0);
        roughnessFactor = mix(roughnessFactor, 0.62, discFace.b);
        roughnessFactor = mix(roughnessFactor, 1.0, discFace.r);`,
      ],
      [
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.0, max(discFace.r, discFace.b * 0.7));`,
      ],
      [
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += lanternThroughHole(vLanternWorld) * discFace.r * (1.0 + 0.4 * discFace.g);`,
      ],
      // The brushing runs round the disc, so it is rougher across the grooves (along the radius). The direction is in the disc's own
      // texture space: it turns with the disc, and the look does not.
      [
        'vec2 anisotropyV = anisotropyVector;',
        `vec2 discRadial = vUv - 0.5;
        vec2 anisotropyV = length(anisotropyVector) * (1.0 - discFace.r) * (1.0 - discFace.b) * discRadial / max(length(discRadial), 1e-4);`,
      ],
    ]);
  };
  return material;
}

/**
 * Comb teeth and drum hammers, instanced: each bends from its root by its own deflection (attribute aPluck.x, metres at the tip)
 * and glows warm at the tip on release (aPluck.y). The geometry runs from the root (x = -1) to the tip (x = 0).
 */
export function toothMaterial(): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.2, envMapIntensity: 1.2 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlint = { value: new Color(1.0, 0.6, 0.3).multiplyScalar(7) };
    shader.vertexShader = patch(shader.vertexShader, [
      ['#include <common>', '#include <common>\nattribute vec2 aPluck;\nvarying float vGlint;\nvarying float vAlong;'],
      [
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float along = clamp(1.0 + position.x, 0.0, 1.0);
        transformed.y += aPluck.x * along * along;
        vAlong = along;
        vGlint = aPluck.y;`,
      ],
    ]);
    shader.fragmentShader = patch(shader.fragmentShader, [
      ['#include <common>', '#include <common>\nuniform vec3 uGlint;\nvarying float vGlint;\nvarying float vAlong;'],
      [
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += uGlint * vGlint * vGlint * smoothstep(0.5, 1.0, vAlong) * (0.4 + 0.6 * smoothstep(0.85, 1.0, vAlong));`,
      ],
    ]);
  };
  return material;
}

/** Brass, aged: deep gold, satin, its polish worn soft */
export function brassMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: new Color(0.6, 0.4, 0.16), metalness: 1, roughness: 0.36 });
}

/** Steel: polished for the screws and the spindle's nut, duller for the disc's sheared edge */
export function steelMaterial(roughness = 0.24): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: new Color(0.62, 0.61, 0.6), metalness: 1, roughness });
}

/** French-polished walnut; the lid's frame catches the lantern's glow */
export function walnutMaterial(textures: Textures, lantern?: Lantern): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({ map: textures.walnut, roughness: 0.5, clearcoat: 0.7, clearcoatRoughness: 0.28 });
  if (lantern) material.onBeforeCompile = (shader) => lantern.receive(shader, false);
  return material;
}

/** Oxblood velvet lining the case */
export function velvetMaterial(): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: new Color(0.045, 0.008, 0.007),
    roughness: 0.95,
    sheen: 1,
    sheenColor: new Color(0.32, 0.07, 0.05),
    sheenRoughness: 0.5,
  });
}

/** The aged paper inside the lid, where the lantern throws the notes */
export function paperMaterial(textures: Textures, lantern: Lantern): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ map: textures.paper, roughness: 0.88, side: DoubleSide });
  material.defines = { USE_UV: '' };
  material.onBeforeCompile = (shader) => lantern.receive(shader, true);
  return material;
}

/** The room's plain surfaces: the table's leather, the plaster wall */
export function roomMaterial(color: Color, roughness: number, roughnessMap: Texture | null = null): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness, roughnessMap });
}

/** Cheap value noise for shader patches */
const NOISE_GLSL = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;
