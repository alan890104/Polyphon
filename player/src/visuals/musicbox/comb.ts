// The comb: a brass bridge set at a slant beside the comb's radius, and from it one steel tooth per track reaching over the disc so
// its tip rides the track exactly on the comb's radius (where a perforation arrives the moment it sounds). Low notes are inside and
// have the longest teeth, so the comb tapers like a harp. The drum rings are read by brass hammers past its inner end, longer still
// and wider by the weight of their drum.
//
// The tips all sit on the line x = 0 (the comb's radius, +z); the teeth lie downstream of it (x < 0), out of the way of what is
// coming. One draw call for all the teeth (instanced), with each tooth's bend and glint in an instanced attribute.

import { BoxGeometry, Color, CylinderGeometry, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Drum } from '../timeline.ts';
import { DISC_RADIUS, type DiscLayout } from './layout.ts';
import type { Plucks, ToothMotion } from './plucks.ts';

/** Tooth lengths at the inner and outer ends of the tracks (metres) */
const LONGEST_TOOTH = 0.066;
const SHORTEST_TOOTH = 0.036;
/** Heights above the disc of a tooth's root and of its tip at rest */
const ROOT_HEIGHT = 0.0085;
const TIP_HEIGHT = 0.0016;
const TOOTH_THICKNESS = 0.0011;
/** A hammer's width in teeth */
const HAMMER_WIDTH: Record<Drum, number> = { low: 2.2, mid: 1.7, high: 1.3 };
/** The bridge's cross-section */
const BRIDGE_WIDTH = 0.016;
const BRIDGE_HEIGHT = 0.011;
const STEEL = new Color(0.86, 0.85, 0.83);
const HAMMER = new Color(0.95, 0.72, 0.42);

export interface CombMaterials {
  tooth: Material;
  brass: Material;
  steel: Material;
}

export class Comb {
  readonly group = new Group();
  private readonly pluck: InstancedBufferAttribute;
  private readonly motion: ToothMotion = { deflection: 0, glint: 0 };

  constructor(layout: DiscLayout, materials: CombMaterials) {
    const { rows } = layout;
    const inner = Math.min(...rows.map((r) => r.radius)) - 0.008;
    const outer = DISC_RADIUS + 0.034;
    const pitched = rows.filter((r) => !r.drum).map((r) => r.radius);
    const lowest = Math.min(...pitched);
    const highest = Math.max(...pitched);
    const lengthAt = (radius: number) => {
      const k = highest > lowest ? (radius - lowest) / (highest - lowest) : 0.5;
      return LONGEST_TOOTH + (SHORTEST_TOOTH - LONGEST_TOOTH) * k;
    };

    // Teeth: a unit bar from root (x = -1) to tip (x = 0), scaled and sloped down towards the disc per tooth. Its section is a
    // flattened octagon, not a box, so every tooth's polished top catches a line of light and the comb reads tooth by tooth.
    const bar = new CylinderGeometry(0.5, 0.5, 1, 8, 12)
      .rotateZ(Math.PI / 2)
      .rotateX(Math.PI / 8)
      .scale(1, TOOTH_THICKNESS, 1)
      .translate(-0.5, 0, 0);
    const teeth = new InstancedMesh(bar, materials.tooth, rows.length);
    teeth.instanceColor = new InstancedBufferAttribute(new Float32Array(rows.length * 3), 3);
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const axis = new Vector3(0, 0, 1);
    const width = Math.min(layout.spacing * 0.6, 0.0036);
    rows.forEach((row, i) => {
      const length = lengthAt(row.radius);
      // Tipped down towards the disc: the root (x = -length) rises to the bridge
      rotation.setFromAxisAngle(axis, -Math.atan2(ROOT_HEIGHT - TIP_HEIGHT, length));
      const scale = new Vector3(length, 1, width * (row.drum ? HAMMER_WIDTH[row.drum] : 1));
      teeth.setMatrixAt(i, matrix.compose(new Vector3(0, TIP_HEIGHT + TOOTH_THICKNESS / 2, row.radius), rotation, scale));
      teeth.setColorAt(i, row.drum ? HAMMER : STEEL);
    });
    this.pluck = new InstancedBufferAttribute(new Float32Array(rows.length * 2), 2);
    teeth.geometry.setAttribute('aPluck', this.pluck);
    teeth.castShadow = teeth.receiveShadow = true;
    // The teeth bend in the shader; keep three from culling them by their rest bounds
    teeth.frustumCulled = false;
    this.group.add(teeth);

    // The bridge the teeth are cut from: a brass bar along the line of their roots, running out past the rim to its post
    const rootAt = (radius: number) => new Vector3(-lengthAt(radius) - BRIDGE_WIDTH / 2 + 0.001, ROOT_HEIGHT + BRIDGE_HEIGHT / 2 - 0.002, radius);
    const a = rootAt(inner);
    const b = rootAt(outer);
    const span = b.clone().sub(a);
    const bridge = new Mesh(new BoxGeometry(BRIDGE_WIDTH, BRIDGE_HEIGHT, span.length() + BRIDGE_WIDTH * 0.6), materials.brass);
    bridge.position.copy(a).add(b).multiplyScalar(0.5);
    bridge.rotation.y = Math.atan2(span.x, span.z);

    // Its post, standing in the case outside the rim
    const post = new Mesh(new BoxGeometry(0.026, 0.09, 0.022), materials.brass);
    post.position.set(b.x, b.y - 0.045 - BRIDGE_HEIGHT / 2 + 0.002, b.z - 0.004);
    post.rotation.y = bridge.rotation.y;

    // Steel screws along the bridge, one between every few teeth, in one mesh
    const count = Math.max(3, Math.round(span.length() / 0.03));
    const screws = Array.from({ length: count + 1 }, (_, i) => {
      const p = a.clone().lerp(b, (i + 0.5) / (count + 1));
      return new CylinderGeometry(0.0028, 0.0031, 0.0016, 20).translate(p.x, p.y + BRIDGE_HEIGHT / 2 + 0.0008, p.z);
    });
    const screwHeads = new Mesh(mergeGeometries(screws), materials.steel);
    for (const part of [bridge, post, screwHeads]) {
      part.castShadow = part.receiveShadow = true;
      this.group.add(part);
    }
  }

  /** Bend and light every tooth for song time `t` */
  update(plucks: Plucks, t: number, still: boolean): void {
    const array = this.pluck.array as Float32Array;
    for (let i = 0; i < plucks.count; i++) {
      plucks.motion(i, t, still, this.motion);
      array[i * 2] = this.motion.deflection;
      array[i * 2 + 1] = this.motion.glint;
    }
    this.pluck.needsUpdate = true;
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
  }
}
