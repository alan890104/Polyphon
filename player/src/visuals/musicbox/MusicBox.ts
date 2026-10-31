// The Polyphon: a disc music box on a table in a lamplit room, playing the song. The disc carries the song's perforations and makes
// one turn per pass of the song; each perforation plucks its tooth of the comb exactly as its note sounds; a lamp inside the case
// throws the notes being played onto the inside of the lid.
//
// draw(t) renders the frame for song time t and depends on nothing else, so frames can be rendered offline in any order; a live view
// passes the time since its last frame too, and the camera eases where it would otherwise cut (after a seek).

import { songDuration, type Song } from 'polyphon';
import {
  AgXToneMapping,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  PCFShadowMap,
  PerspectiveCamera,
  PointLight,
  Scene,
  SphereGeometry,
  SpotLight,
  Vector3,
  WebGLRenderer,
  type Texture,
} from 'three';
import { EMPTY_DISC, songDisc } from '../../disc.ts';
import { cabinet, LEATHER, PLASTER } from './cabinet.ts';
import { applyShot, copyShot, easeShot, sameShot, shotAt, type Shot } from './camera.ts';
import { Comb } from './comb.ts';
import { discTexture } from './discTexture.ts';
import { warmRoom } from './environment.ts';
import { Lantern } from './lantern.ts';
import { DISC_RADIUS, DISC_THICKNESS, layoutDisc, type DiscLayout } from './layout.ts';
import {
  brassMaterial,
  discMaterial,
  paperMaterial,
  roomMaterial,
  steelMaterial,
  toothMaterial,
  velvetMaterial,
  walnutMaterial,
  type DiscFace,
  type Textures,
} from './materials.ts';
import { Plucks } from './plucks.ts';
import { Post } from './post.ts';
import { mottleTexture, paperTexture, walnutTexture } from './textures.ts';

export interface MusicBoxOptions {
  /** A WebGL 2 context already taken from the canvas */
  context?: WebGL2RenderingContext;
  /** Hold the camera still and the teeth from swinging (the disc still turns and the notes still light): reduced motion */
  reducedMotion?: boolean;
  /** A CSS font family for the title printed on the disc */
  font?: string;
  /** Keep the drawing buffer, to read frames back */
  preserveDrawingBuffer?: boolean;
}

/** What the box may spend on each frame */
export interface Budget {
  /** Multisampling for the scene, 0-4 */
  samples: number;
  /** Pixels across the disc's face texture (from the next song on) */
  discSize: number;
}

export interface DrawOptions {
  /** Seconds since the previous frame of a live view: the camera eases to its shot, and the lamp comes up over the first frames */
  dt?: number;
  /** 0-1: how far the camera travels (default 1) */
  motion?: number;
}

type Materials = ReturnType<typeof makeMaterials>;

const DEFAULT_FONT = '"Instrument Serif", serif';
const EXPOSURE = 1.3;
/** Seconds the camera takes to cover most of the way to a new shot */
const CAMERA_EASE = 0.7;
/** Seconds the lamp takes to come up when the view opens */
const LIGHT_UP = 0.8;
/** Seconds a blank disc would take to turn (it stays at the start: nothing plays) */
const BLANK_TURN = 60;

export class MusicBox {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(22, 16 / 9, 0.05, 12);
  private readonly post: Post;
  private readonly lantern = new Lantern();
  private readonly turntable = new Group();
  private readonly textures: Textures;
  private readonly materials: Materials;
  private readonly face: DiscFace = { value: null };
  private readonly options: MusicBoxOptions;
  private budget: Budget = { samples: 4, discSize: 2048 };
  /** Where the camera is, and where its shot for this frame wants it */
  private readonly shot: Shot = { position: new Vector3(), target: new Vector3(), fov: 22, focus: 1 };
  private readonly aim: Shot = { position: new Vector3(), target: new Vector3(), fov: 22, focus: 1 };
  // The disc on the turntable, its comb and their timing: set by mount()
  private layout!: DiscLayout;
  private comb: Comb | null = null;
  private plucks!: Plucks;
  /** Seconds one turn takes */
  private duration = BLANK_TURN;
  /** The song time the disc is drawn at: held while the next song's disc is prepared */
  private time = 0;
  private preparing = false;
  /** Counts setSong calls, so a slow one that finishes after a newer one is dropped */
  private songRequest = 0;
  private width = 1;
  private height = 1;
  /** 0-1: how far the lamp has come up; null before the first frame */
  private light: number | null = null;
  /** The song time of the frame on the canvas, and whether anything has changed since that it does not show */
  private drawnAt = NaN;
  private changed = true;

  /** Paint the textures (a few rows between frames) and compile every shader, so the first frame draws without a stall */
  static async create(canvas: HTMLCanvasElement, options: MusicBoxOptions = {}): Promise<MusicBox> {
    const textures = { walnut: await walnutTexture(), paper: await paperTexture(), mottle: await mottleTexture() };
    const box = new MusicBox(canvas, options, textures);
    await box.renderer.compileAsync(box.scene, box.camera);
    return box;
  }

  private constructor(canvas: HTMLCanvasElement, options: MusicBoxOptions, textures: Textures) {
    this.options = options;
    this.textures = textures;
    this.renderer = new WebGLRenderer({
      canvas,
      context: options.context,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
    });
    this.renderer.toneMapping = AgXToneMapping;
    this.renderer.toneMappingExposure = EXPOSURE;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.post = new Post(this.renderer, this.budget.samples);

    this.scene.background = new Color(0.02, 0.012, 0.008);
    this.scene.environment = warmRoom(this.renderer);
    this.scene.environmentIntensity = 0.55;
    this.materials = makeMaterials(textures, this.lantern, this.face);
    this.scene.add(cabinet(this.materials));
    this.scene.add(this.turntable);
    this.buildTurntable();
    this.addLights();

    // A blank disc under the comb until the first song is set
    const blank = layoutDisc(EMPTY_DISC);
    this.mount(blank, this.makeFace(blank, ''), BLANK_TURN);
  }

  /**
   * Punch the song's disc, tune the comb to it and print its title (null: a blank disc). The new disc is drawn and sent to the GPU
   * while the old one stays, then swapped in at once, so the change never stalls a frame; the old disc holds still meanwhile.
   */
  async setSong(song: Song | null): Promise<void> {
    const request = ++this.songRequest;
    this.preparing = true;
    const font = this.options.font ?? DEFAULT_FONT;
    await document.fonts.load(`italic 100px ${font}`).catch(() => undefined);
    if (request !== this.songRequest) return;
    const layout = layoutDisc(song ? songDisc(song) : EMPTY_DISC);
    const face = this.makeFace(layout, song?.title ?? '');
    this.renderer.initTexture(face);
    await new Promise((resolve) => setTimeout(resolve));
    if (request !== this.songRequest) {
      face.dispose();
      return;
    }
    const { intro, loop } = song ? songDuration(song) : { intro: 0, loop: BLANK_TURN };
    this.mount(layout, face, Math.max(1e-3, intro + loop));
    this.preparing = false;
  }

  /** Size in device pixels */
  setSize(width: number, height: number): void {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(this.width, this.height, false);
    this.post.setSize(this.width, this.height);
    this.changed = true;
  }

  setBudget(budget: Budget): void {
    this.budget = budget;
    this.post.setSamples(budget.samples);
    this.changed = true;
  }

  /** Render the frame for song time `t` (seconds from the start of the song, as the playback's position reports it) */
  draw(t: number, { dt, motion = 1 }: DrawOptions = {}): void {
    const still = this.options.reducedMotion ?? false;
    const aspect = this.width / this.height;
    shotAt(t, aspect, still ? 0 : motion, this.aim);
    // Paused, with nothing left moving: the canvas already shows this frame
    if (t === this.drawnAt && this.light === 1 && !this.changed && sameShot(this.shot, this.aim)) return;

    if (!this.preparing) this.time = t;
    this.turntable.rotation.y = (-this.time / this.duration) * Math.PI * 2;
    this.comb?.update(this.plucks, this.time, still);
    this.lantern.update(this.plucks, this.layout.rows, this.time);
    if (dt === undefined || this.light === null) copyShot(this.shot, this.aim);
    else easeShot(this.shot, this.aim, 1 - Math.exp(-dt / CAMERA_EASE));
    applyShot(this.camera, this.shot, aspect);

    this.light = dt === undefined ? 1 : Math.min(1, (this.light ?? 0) + dt / LIGHT_UP);
    this.renderer.toneMappingExposure = EXPOSURE * this.light * (2 - this.light);
    this.post.render(this.scene, this.camera, { focus: this.shot.focus, frame: Math.round(t * 60) });
    this.drawnAt = t;
    this.changed = false;
  }

  dispose(): void {
    this.songRequest++;
    this.comb?.dispose();
    this.post.dispose();
    for (const t of Object.values(this.textures)) t.dispose();
    this.face.value?.dispose();
    this.scene.environment?.dispose();
    for (const m of Object.values(this.materials)) m.dispose();
    this.scene.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    this.renderer.dispose();
    // The canvas is thrown away with the view: give its GPU memory back now rather than at the next collection
    this.renderer.forceContextLoss();
  }

  /** Put a punched disc on the turntable and tune the comb to it */
  private mount(layout: DiscLayout, face: Texture, duration: number): void {
    this.layout = layout;
    this.duration = duration;
    this.lantern.setDuration(duration);
    this.face.value?.dispose();
    this.face.value = face;
    if (this.comb) {
      this.scene.remove(this.comb.group);
      this.comb.dispose();
    }
    this.comb = new Comb(layout, this.materials);
    this.scene.add(this.comb.group);
    this.plucks = new Plucks(layout, duration);
    this.changed = true;
  }

  private makeFace(layout: DiscLayout, title: string): Texture {
    const font = this.options.font ?? DEFAULT_FONT;
    return discTexture(layout, { title, font }, this.budget.discSize, this.renderer.capabilities.getMaxAnisotropy());
  }

  /** The disc and what turns with it: the clamp at its centre */
  private buildTurntable(): void {
    // The disc receives shadows (the teeth's) but casts none: all it could shadow is the velvet out of sight beneath it, and a thin
    // flat caster lit at a low angle shadows itself in a pattern that changes as it turns
    const face = new Mesh(new CircleGeometry(DISC_RADIUS, 256).rotateX(-Math.PI / 2), this.materials.disc);
    face.receiveShadow = true;
    const rim = new Mesh(new CylinderGeometry(DISC_RADIUS, DISC_RADIUS, DISC_THICKNESS, 256, 1, true).translate(0, -DISC_THICKNESS / 2, 0), this.materials.edge);
    this.turntable.add(face, rim);
    // The centre clamp: a brass washer and a domed steel nut on the spindle
    const washer = new Mesh(new CylinderGeometry(0.024, 0.0255, 0.0035, 72).translate(0, 0.00175, 0), this.materials.brass);
    const nut = new Mesh(new CylinderGeometry(0.0095, 0.0105, 0.009, 6).translate(0, 0.008, 0), this.materials.steel);
    const dome = new Mesh(new SphereGeometry(0.0072, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.0125, 0), this.materials.steel);
    for (const m of [washer, nut, dome]) {
      m.castShadow = m.receiveShadow = true;
      this.turntable.add(m);
    }
  }

  private addLights(): void {
    // The key: a shaded lamp up to the left, beside the box rather than behind it, so the steel never mirrors it straight back at
    // the camera (a hard streak through the spindle) and shows the room's soft light instead. It edges the comb's teeth and throws
    // their shadows across the disc.
    const key = new SpotLight(new Color(1.0, 0.74, 0.5), 3.2, 0, 0.42, 0.85, 2);
    key.position.set(-1.5, 1.1, -0.25);
    key.target.position.set(0, 0, -0.02);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1.0;
    key.shadow.camera.far = 3.0;
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.0015;
    key.shadow.radius = 3;
    this.scene.add(key, key.target);
    // The same lamp's spill on the wall behind, up to the left
    const wash = new PointLight(new Color(1.0, 0.7, 0.45), 1.6, 0, 2);
    wash.position.set(-1.1, 0.75, -0.7);
    this.scene.add(wash);
    // A faint back light from the right, to edge the comb and the lid
    const rim = new DirectionalLight(new Color(1.0, 0.85, 0.7), 0.35);
    rim.position.set(1.2, 1.0, -1.2);
    this.scene.add(rim);
    // Light bounced off the room in front: just enough to read the lid's paper and the case's faces
    const fill = new PointLight(new Color(1.0, 0.8, 0.62), 1.1, 0, 2);
    fill.position.set(-0.3, 0.8, 1.3);
    this.scene.add(fill);
  }
}

function makeMaterials(textures: Textures, lantern: Lantern, face: DiscFace) {
  return {
    disc: discMaterial(lantern, face),
    tooth: toothMaterial(),
    brass: brassMaterial(),
    steel: steelMaterial(),
    edge: steelMaterial(0.5),
    walnut: walnutMaterial(textures),
    walnutLid: walnutMaterial(textures, lantern),
    velvet: velvetMaterial(),
    paper: paperMaterial(textures, lantern),
    leather: roomMaterial(LEATHER, 0.62, textures.mottle),
    plaster: roomMaterial(PLASTER, 0.95),
  };
}
