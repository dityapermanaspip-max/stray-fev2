import type Phaser from 'phaser';
import type { FieldView } from '../../../stray-bev1/shared/field.ts';
import { ActorBody } from './actor.ts';
import { depthAt, tileCenter } from './iso.ts';
import { heightAt } from './marks.ts';

// The people standing in a room (shop keeper, innkeeper, trainer, guests): the same figure as a player, standing
// still on their tile with their name. Looks only: the server decides who is where and what they say.

export function drawNpcs(scene: Phaser.Scene, view: FieldView): ActorBody[] {
  return view.npcs.map((n) => {
    const body = new ActorBody(scene, n.name, false, n.look ?? undefined);
    const at = tileCenter(n.x, n.y, heightAt(view, n.x, n.y));
    body.root.setPosition(at.x, at.y).setDepth(depthAt(n.x, n.y));
    return body;
  });
}
