import Phaser from 'phaser';
import type { BattleFighter } from '../../../stray-bev1/shared/battle.ts';
import { CREATURE_LOOKS, creatureAssets } from '../assets/manifest.ts';

// Foe sprites for the battle board: 8 pictures per creature look. idle_1 and idle_2 swap while it stands, attack_1 then
// attack_2 play on a strike, hit_1 on a hit and hit_2 on a crit or stagger, wounded stays while the body is at its lowest
// tier, dead stays after the fall. The art faces down-left, which is how foes face.

const IDLE_MS = 650;
const BEAT_MS = 220; // one attack frame
const HIT_MS = 380;
const CORRUPT_TINT = 0xb48ad0; // normal frames worn by a corrupted foe whose own art is not made yet

export const hasCreatureArt = (f: BattleFighter) => f.side === 'enemy' && !!f.look && CREATURE_LOOKS.includes(f.look);

export type CreatureArt = { id: string; frames: Record<string, string>; timer?: Phaser.Time.TimerEvent };

// Loads the frames of every creature look in this fight (once per look).
export function loadCreatures(scene: Phaser.Scene, fighters: BattleFighter[]): Promise<void> {
  const need = new Map<string, ReturnType<typeof creatureAssets>>();
  for (const f of fighters) if (hasCreatureArt(f)) need.set(creatureAssets(f.look!, f.corrupted).id, creatureAssets(f.look!, f.corrupted));
  let queued = 0;
  for (const a of need.values()) for (const fr of a.frames) if (!scene.textures.exists(fr.key)) { scene.load.image(fr.key, fr.path); queued++; }
  if (queued === 0) return Promise.resolve();
  return new Promise((done) => {
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => done());
    scene.load.start();
  });
}

// The sprite for a foe, or null when its frames did not load (the caller keeps the token). Feet at (0, 0).
export function makeCreature(scene: Phaser.Scene, f: BattleFighter, height: number): { sprite: Phaser.GameObjects.Sprite; art: CreatureArt } | null {
  const a = creatureAssets(f.look!, f.corrupted);
  const frames = Object.fromEntries(a.frames.map((fr) => [fr.frame, fr.key]));
  if (!scene.textures.exists(frames.idle_1)) return null;
  const sprite = scene.add.sprite(0, 0, frames.idle_1).setOrigin(0.5, 0.95);
  sprite.setScale(height / sprite.height);
  if (a.tint) sprite.setTint(CORRUPT_TINT);
  sprite.setInteractive({ pixelPerfect: false, useHandCursor: true });
  return { sprite, art: { id: a.id, frames } };
}

// Plays the pose the battle scene asks for (the names the player's sheet uses). `wounded`: the body is at its lowest tier.
export function creaturePose(sprite: Phaser.GameObjects.Sprite, art: CreatureArt, name: string, wounded: boolean): void {
  const scene = sprite.scene;
  art.timer?.remove();
  const show = (frame: string) => sprite.setTexture(art.frames[frame]);
  const rest = () => (wounded ? (show('wounded'), undefined) : idle());
  const idle = () => {
    let swap = false;
    show('idle_1');
    art.timer = scene.time.addEvent({ delay: IDLE_MS, loop: true, callback: () => show((swap = !swap) ? 'idle_2' : 'idle_1') });
  };
  const play = (frames: string[], ms: number) => {
    let i = 0;
    show(frames[0]);
    art.timer = scene.time.addEvent({ delay: ms, repeat: frames.length - 1, callback: () => (++i < frames.length ? show(frames[i]) : rest()) });
  };
  switch (name) {
    case 'down': return void show('dead');
    case 'punch': case 'kick': return play(['attack_1', 'attack_2'], BEAT_MS);
    case 'hurt': return play(['hit_1'], HIT_MS);
    case 'stagger': return play(['hit_2'], HIT_MS);
    default: return rest(); // stance, dodge, cheer
  }
}
