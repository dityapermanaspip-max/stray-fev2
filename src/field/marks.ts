import type Phaser from 'phaser';
import type { FieldView } from '../../../stray-bev1/shared/field.ts';
import { depthAt, surfaceHeight, tileCenter } from './iso.ts';

// Small looks on the field: the height a tile's surface stands at, and the ring that fades where the player tapped.

export function heightAt(view: FieldView, x: number, y: number): number {
  const t = view.tiles[y * view.width + x];
  return t ? surfaceHeight(t) : 0;
}

export function markTarget(scene: Phaser.Scene, view: FieldView, x: number, y: number): void {
  const at = tileCenter(x, y, heightAt(view, x, y));
  const ring = scene.add.ellipse(at.x, at.y, 40, 20).setStrokeStyle(2, 0xffffff, 0.9).setDepth(depthAt(x, y) - 1);
  scene.tweens.add({ targets: ring, alpha: 0, scale: 1.4, duration: 500, onComplete: () => ring.destroy() });
}
