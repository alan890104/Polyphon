// The case and the room: a walnut box lined in oxblood velvet with its lid open behind the disc (aged paper inside, where the
// lantern throws the notes), on a leather-topped table against a plaster wall. Few meshes, merged where they share a material.

import { BoxGeometry, Color, Group, Mesh, PlaneGeometry, type BufferGeometry, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Half the case's inside width, the walls' thickness, and the heights of its top edge and its base (the disc is at 0) */
const CASE_INNER = 0.28;
const WALL = 0.024;
const CASE_OUTER = CASE_INNER + WALL;
const CASE_TOP = 0.016;
const CASE_BOTTOM = -0.17;
/** How far the lid is opened (radians from shut) */
const LID_OPEN = (103 * Math.PI) / 180;
const LID_THICKNESS = 0.026;
const LID_FRAME = 0.036;
const WALL_Z = -1.15;

export const LEATHER = new Color(0.075, 0.034, 0.024);
export const PLASTER = new Color(0.26, 0.14, 0.095);

export interface CabinetMaterials {
  walnut: Material;
  /** The lid's frame, which catches a little of the lantern */
  walnutLid: Material;
  velvet: Material;
  paper: Material;
  leather: Material;
  plaster: Material;
}

export function cabinet(m: CabinetMaterials): Group {
  const group = new Group();
  const height = CASE_TOP - CASE_BOTTOM;
  const y = (CASE_TOP + CASE_BOTTOM) / 2;
  const o = CASE_OUTER;
  const walls = merge([
    box(2 * o, height, WALL, 0, y, o - WALL / 2),
    box(2 * o, height, WALL, 0, y, -o + WALL / 2),
    box(WALL, height, 2 * CASE_INNER, o - WALL / 2, y, 0),
    box(WALL, height, 2 * CASE_INNER, -o + WALL / 2, y, 0),
  ]);
  group.add(shadowed(new Mesh(walls, m.walnut), true));

  // The velvet bed below the disc, seen in the ring between the disc's rim and the walls
  group.add(shadowed(new Mesh(new PlaneGeometry(2 * CASE_INNER, 2 * CASE_INNER).rotateX(-Math.PI / 2).translate(0, -0.028, 0), m.velvet)));

  // The lid, built shut (lying on the case, its inside facing down, measured from the hinge at the back) and then opened. It casts
  // no shadow: a lamp behind it would cut the disc in two with a hard line.
  const lid = new Group();
  lid.position.set(0, CASE_TOP, -o);
  const f = LID_FRAME;
  const frame = merge([
    box(2 * o, 0.012, 2 * o, 0, LID_THICKNESS - 0.006, o),
    box(2 * o, LID_THICKNESS, f, 0, LID_THICKNESS / 2, f / 2),
    box(2 * o, LID_THICKNESS, f, 0, LID_THICKNESS / 2, 2 * o - f / 2),
    box(f, LID_THICKNESS, 2 * o - 2 * f, o - f / 2, LID_THICKNESS / 2, o),
    box(f, LID_THICKNESS, 2 * o - 2 * f, -o + f / 2, LID_THICKNESS / 2, o),
  ]);
  lid.add(shadowed(new Mesh(frame, m.walnutLid)));
  lid.add(shadowed(new Mesh(new PlaneGeometry(2 * o - 2 * f, 2 * o - 2 * f).rotateX(Math.PI / 2).translate(0, LID_THICKNESS - 0.0125, o), m.paper)));
  lid.rotation.x = -LID_OPEN;
  group.add(lid);

  // The table and the wall behind
  group.add(shadowed(new Mesh(new PlaneGeometry(7, 5).rotateX(-Math.PI / 2).translate(0, CASE_BOTTOM, -0.6), m.leather)));
  group.add(shadowed(new Mesh(new PlaneGeometry(7, 3.2).translate(0, CASE_BOTTOM + 1.6, WALL_Z), m.plaster)));
  return group;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry {
  return new BoxGeometry(w, h, d).translate(x, y, z);
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  return mergeGeometries(parts)!;
}

/** Receives shadows, and casts them too if asked */
function shadowed(mesh: Mesh, casts = false): Mesh {
  mesh.receiveShadow = true;
  mesh.castShadow = casts;
  return mesh;
}
