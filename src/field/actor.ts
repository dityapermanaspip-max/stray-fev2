import Phaser from 'phaser';
import { actorAssets, PLAYER_ACTOR } from '../assets/manifest.ts';
import { TILE_W } from './iso.ts';

// A walking figure on the field: shadow, sprite (or a round token until its sheet is loaded) and name.
// Looks only: it faces the way it last stepped and plays its walk while moving; the server decides where it is.
// Sheets have front poses facing down-right (+x) and back poses facing up-left (-x); a mirror gives the other two.

const SCREEN_HEIGHT = TILE_W * 0.9; // a standing figure's height on screen
const HEADING_DECAY = 0.6; // how much of the earlier steps the heading keeps
const TURN_RATIO = 0.5; // a side of the heading must be at least this share of the other to turn toward it
const SELF_COLOR = 0xf5d06f;
const OTHER_COLOR = 0x9ec5f0;

type AnimSpec = { frames: string[]; fps: number; repeat: number };
export type Meta = { anims?: Record<string, AnimSpec>; actorHeight?: number; shadow?: boolean }; // shadow: the art has its own
export const metaOf = (scene: Phaser.Scene, key: string) => (scene.textures.get(key).customData as { meta?: Meta }).meta ?? {};

export const animKey = (atlasKey: string, anim: string) => `${atlasKey}:${anim}`;

// Loads the sheets of the given looks (default: the player's) once each and makes their animations (from meta.anims).
// Resolves false when one cannot be loaded; a body whose look has no animations draws as a round token.
export async function loadActors(scene: Phaser.Scene, looks: string[] = [PLAYER_ACTOR]): Promise<boolean> {
  const all = await Promise.all([...new Set(looks)].map((look) => loadLook(scene, look)));
  return all.every(Boolean);
}

function loadLook(scene: Phaser.Scene, look: string): Promise<boolean> {
  const a = actorAssets(look);
  if (scene.textures.exists(a.atlasKey)) return Promise.resolve(true);
  return new Promise((done) => {
    const failed = (file: Phaser.Loader.File) => file.key === a.atlasKey && done(false);
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, failed);
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, failed);
      if (!scene.textures.exists(a.atlasKey)) return done(false);
      for (const [name, spec] of Object.entries(metaOf(scene, a.atlasKey).anims ?? {})) {
        const key = animKey(a.atlasKey, name);
        if (scene.anims.exists(key)) continue;
        scene.anims.create({ key, frames: spec.frames.map((frame) => ({ key: a.atlasKey, frame })), frameRate: spec.fps, repeat: spec.repeat });
      }
      done(true);
    });
    scene.load.atlas(a.atlasKey, a.image, a.atlas);
    scene.load.start();
  });
}

export class ActorBody {
  readonly root: Phaser.GameObjects.Container;
  private sprite?: Phaser.GameObjects.Sprite;
  private atlasKey: string;
  private front = true;
  private flip = false;
  private heading = { x: 0, y: 1 }; // screen direction, decaying sum of recent steps
  private walking = false;
  private playing = '';

  constructor(scene: Phaser.Scene, name: string, self: boolean, look = PLAYER_ACTOR) {
    this.atlasKey = actorAssets(look).atlasKey;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const sheet = scene.anims.exists(animKey(this.atlasKey, 'idle_front'));
    if (!sheet || !metaOf(scene, this.atlasKey).shadow) parts.push(scene.add.ellipse(0, 0, 30, 12, 0x000000, 0.35));
    let top = 34;
    if (sheet) {
      this.sprite = scene.add.sprite(0, 0, this.atlasKey);
      const height = metaOf(scene, this.atlasKey).actorHeight ?? 192;
      this.sprite.setScale(SCREEN_HEIGHT / height);
      parts.push(this.sprite);
      top = SCREEN_HEIGHT + 4;
    } else {
      parts.push(scene.add.circle(0, -16, 11, self ? SELF_COLOR : OTHER_COLOR).setStrokeStyle(2, 0x1b1b1b));
    }
    const label = scene.add.text(0, -top, name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1);
    if (self) label.setColor('#f5d06f');
    parts.push(label);
    this.root = scene.add.container(0, 0, parts);
    this.show();
  }

  // Faces the recent heading on screen: toward the viewer when it goes down the screen, mirrored when it goes left.
  // Paths step along the grid axes only, so "straight down" is a zigzag of +x and +y steps; the heading is a decaying
  // sum of the steps, and the mirror changes only when the sideways part clearly leads (no flip on every step).
  face(dx: number, dy: number): void {
    this.heading = { x: this.heading.x * HEADING_DECAY + (dx - dy), y: this.heading.y * HEADING_DECAY + (dx + dy) };
    const { x, y } = this.heading;
    if (Math.abs(y) >= Math.abs(x) * TURN_RATIO) this.front = y > 0;
    if (Math.abs(x) >= Math.abs(y) * TURN_RATIO) this.flip = this.front ? x < 0 : x > 0;
    this.show();
  }

  walk(on: boolean): void {
    if (on === this.walking) return;
    this.walking = on;
    this.show();
  }

  // Plays the pose for the current facing and motion (only on a change).
  private show(): void {
    if (!this.sprite) return;
    this.sprite.setFlipX(this.flip);
    const key = animKey(this.atlasKey, `${this.walking ? 'walk' : 'idle'}_${this.front ? 'front' : 'back'}`);
    if (key === this.playing) return;
    this.playing = key;
    this.sprite.play(key);
  }
}
