// The camera: a long lens looking across the comb at the disc and the lid behind. Over a long cycle it pushes in slowly from the
// wide shot (the whole box, filling the frame) to a closer one low across the comb (the lid's thrown notes still in frame) and back,
// with a slight drift on a few incommensurate sine waves, so it never visibly loops. A pure function of song time.
//
// Each shot is framed by what must stay in it, so the box fills a phone held upright as well as a wide screen: a narrow frame steps
// back and looks down a little more, which brings in the disc's face and the table instead of empty wall.

import { MathUtils, Vector3, type PerspectiveCamera } from 'three';

export interface Shot {
  position: Vector3;
  target: Vector3;
  /** Vertical field of view (degrees) */
  fov: number;
  /** Distance to the plane in focus (metres) */
  focus: number;
}

interface Pose {
  azimuth: number;
  elevation: number;
  target: Vector3;
  /** The lens's angle across the frame's longer side (degrees) */
  lens: number;
  /** Metres across and up that must be in frame at the target */
  width: number;
  height: number;
}

/** Right of the comb and above it, looking back over the disc to the lid: the whole box */
const WIDE: Pose = { azimuth: 0.36, elevation: 0.44, target: new Vector3(0.0, 0.1, -0.03), lens: 34, width: 0.94, height: 0.58 };
/** Low over the comb's tips, the disc running away to the lid */
const CLOSE: Pose = { azimuth: 0.42, elevation: 0.3, target: new Vector3(0.0, 0.09, 0.0), lens: 36, width: 0.68, height: 0.44 };
/** Seconds for one push in and back out */
const CYCLE = 100;
/** An upright frame (a phone held upright) looks down this much further, and centres this much higher, to take in the whole lid */
const UPRIGHT_TILT = 0.12;
const UPRIGHT_LIFT = 0.1;
/** What stays sharp: the teeth's tips, halfway along the comb */
const FOCUS = new Vector3(0, 0.004, 0.16);

/** The shot at song time `t` for a frame of `aspect` (width / height); `motion` 0-1 scales the push-in and the drift */
export function shotAt(t: number, aspect: number, motion: number, out: Shot): Shot {
  const wave = (period: number, phase: number) => Math.sin((t / period + phase) * Math.PI * 2) * motion;
  // Eased so it lingers at both ends
  const k = motion * (0.5 - 0.5 * Math.cos((t / CYCLE) * Math.PI * 2));
  const ease = k * k * (3 - 2 * k);
  const pose = (key: Exclude<keyof Pose, 'target'>) => MathUtils.lerp(WIDE[key], CLOSE[key], ease);
  const upright = MathUtils.clamp(1.6 - aspect, 0, 1);
  const azimuth = pose('azimuth') + 0.08 * wave(67, 0.1) + 0.03 * wave(29, 0.6);
  const elevation = pose('elevation') + UPRIGHT_TILT * upright + 0.03 * wave(83, 0.35);

  // The lens covers the longer side; the distance is whatever fits the width and the height needed
  const long = Math.tan(MathUtils.degToRad(pose('lens')) / 2);
  const tall = aspect >= 1 ? long / aspect : long;
  const wide = tall * aspect;
  const distance = Math.max(pose('width') / 2 / wide, pose('height') / 2 / tall) * (1 + 0.03 * wave(53, 0.8));

  out.target.lerpVectors(WIDE.target, CLOSE.target, ease);
  out.target.x += 0.01 * wave(97, 0.2);
  out.target.y += UPRIGHT_LIFT * upright + 0.005 * wave(71, 0.5);
  out.position.set(
    out.target.x + distance * Math.cos(elevation) * Math.sin(azimuth),
    out.target.y + distance * Math.sin(elevation),
    out.target.z + distance * Math.cos(elevation) * Math.cos(azimuth),
  );
  out.fov = MathUtils.radToDeg(2 * Math.atan(tall));
  out.focus = out.position.distanceTo(FOCUS);
  return out;
}

/** Move `shot` part of the way (0-1) towards `to` */
export function easeShot(shot: Shot, to: Shot, amount: number): void {
  shot.position.lerp(to.position, amount);
  shot.target.lerp(to.target, amount);
  shot.fov += (to.fov - shot.fov) * amount;
  shot.focus += (to.focus - shot.focus) * amount;
}

/** Two shots the same to a hundredth of a millimetre */
export function sameShot(a: Shot, b: Shot): boolean {
  return a.position.distanceToSquared(b.position) < 1e-10 && a.target.distanceToSquared(b.target) < 1e-10 && Math.abs(a.fov - b.fov) < 1e-4;
}

export function copyShot(shot: Shot, from: Shot): void {
  shot.position.copy(from.position);
  shot.target.copy(from.target);
  shot.fov = from.fov;
  shot.focus = from.focus;
}

export function applyShot(camera: PerspectiveCamera, shot: Shot, aspect: number): void {
  camera.position.copy(shot.position);
  camera.lookAt(shot.target);
  camera.aspect = aspect;
  camera.fov = shot.fov;
  camera.updateProjectionMatrix();
}
