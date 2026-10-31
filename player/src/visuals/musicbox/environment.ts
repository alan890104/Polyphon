// The room the metal reflects: a dim, warm study lit by a shaded lamp up to the left, a pale wall to the right, a dark ceiling and
// the table below. Built as a tiny scene and prefiltered once (PMREM) into the environment map every material samples.

import { BackSide, BoxGeometry, Color, Mesh, MeshBasicMaterial, PMREMGenerator, Scene, SphereGeometry, type Texture, type WebGLRenderer } from 'three';

export function warmRoom(renderer: WebGLRenderer): Texture {
  const scene = new Scene();
  const room = new Mesh(new BoxGeometry(8, 5, 8), new MeshBasicMaterial({ color: new Color(0.075, 0.05, 0.034), side: BackSide }));
  room.position.y = 1.5;
  scene.add(room);
  const glow = (color: Color, intensity: number) => new MeshBasicMaterial({ color: color.multiplyScalar(intensity) });

  // The lamp's shade: the strong warm highlight in every reflection
  const shade = new Mesh(new SphereGeometry(0.45, 24, 16), glow(new Color(1.0, 0.7, 0.42), 14));
  shade.position.set(-1.8, 2.1, 1.2);
  scene.add(shade);
  // The lamp's pool on the ceiling above it
  const ceiling = new Mesh(new BoxGeometry(2.4, 0.05, 2.4), glow(new Color(1.0, 0.72, 0.48), 1.1));
  ceiling.position.set(-1.6, 3.95, 0.8);
  scene.add(ceiling);
  // A pale wall to the right and behind, catching the lamp: a long soft highlight on the disc's far side
  const wall = new Mesh(new BoxGeometry(0.05, 2.4, 4.5), glow(new Color(0.9, 0.72, 0.56), 0.55));
  wall.position.set(3.9, 1.4, -0.8);
  scene.add(wall);
  // The wall behind the box, washed by the lamp from the left: what the steel mostly shows, a warm gradient
  const back = new Mesh(new BoxGeometry(6, 2.6, 0.05), glow(new Color(0.85, 0.6, 0.4), 0.3));
  back.position.set(0.5, 0.9, -3.95);
  scene.add(back);
  const pool = new Mesh(new BoxGeometry(1.6, 1.4, 0.05), glow(new Color(1.0, 0.7, 0.45), 0.7));
  pool.position.set(-1.5, 1.3, -3.9);
  scene.add(pool);
  // The table below, dark red-brown
  const table = new Mesh(new BoxGeometry(8, 0.05, 8), glow(new Color(0.09, 0.04, 0.03), 1));
  table.position.y = -0.95;
  scene.add(table);
  // A faint strip from a doorway behind, slightly cooler, so the steel has something besides warm to reflect
  const door = new Mesh(new BoxGeometry(0.9, 2.2, 0.05), glow(new Color(0.75, 0.74, 0.72), 0.5));
  door.position.set(1.4, 1.1, -3.95);
  scene.add(door);

  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.035);
  pmrem.dispose();
  scene.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose();
      (o.material as MeshBasicMaterial).dispose();
    }
  });
  return target.texture;
}
