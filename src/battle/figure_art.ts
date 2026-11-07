import Phaser from 'phaser';
import type { BattleFighter } from '../../../stray-bev1/shared/battle.ts';
import { actorAssets } from '../assets/manifest.ts';
import { animKey, metaOf } from '../field/actor.ts';

// A vice or the boss on the battle board: a character sheet from the server (`figure`), drawn with its front battle poses,
// mirrored to face down-left like every foe, washed in the figure's colour and scaled by its size.

export const figureAtlas = (f: BattleFighter) => (f.figure ? actorAssets(f.figure.sheet).atlasKey : null);

// The sprite (feet at 0, 0) and whether its sheet draws its own shadow, or null when the sheet did not load (the caller keeps the token).
export function makeFigureSprite(scene: Phaser.Scene, f: BattleFighter, height: number): { sprite: Phaser.GameObjects.Sprite; atlas: string; shadow: boolean } | null {
  const atlas = figureAtlas(f);
  if (!f.figure || !atlas || !scene.anims.exists(animKey(atlas, 'stance_front'))) return null;
  const meta = metaOf(scene, atlas);
  const sprite = scene.add.sprite(0, 0, atlas).setFlipX(true);
  sprite.setScale((height * f.figure.scale) / (meta.actorHeight ?? 192));
  if (f.figure.tint !== null) sprite.setTint(f.figure.tint);
  sprite.setInteractive({ pixelPerfect: false, useHandCursor: true });
  return { sprite, atlas, shadow: !!meta.shadow };
}
