import Phaser from 'phaser';
import type { BattleFighter, Word } from '../../../stray-bev1/shared/battle.ts';
import { actorAssets, PLAYER_ACTOR } from '../assets/manifest.ts';
import { animKey, metaOf } from '../field/actor.ts';
import { TILE_W } from '../field/iso.ts';
import { slotPoint } from './board.ts';
import { makeFigureSprite } from './figure_art.ts';
import { creaturePose, hasCreatureArt, makeCreature, type CreatureArt } from './creature_art.ts';

// Fighters on the battle board. Party members wear the player's battle sheet (seen from behind, facing the foes);
// foes are creature sprites (creature_art.ts) or, without art, coloured tokens. Nothing stays on screen about a body: a word floats up only
// when a body tier changes (the server sends it then), damage and healing show as numbers, and crits, misses and
// counters get a mark. The rest is poses: stance, attack, hurt, stagger, dodge, down, cheer.

const COLORS = { you: 0xf5d06f, party: 0x9ec5f0, enemy: 0xd98c6a, corrupted: 0x8e5bb5 };
const RADIUS = 22;
const FIGURE_H = TILE_W * 0.95; // a standing figure's height on the board
const MARKS = { crit: '!', miss: '…', counter: '↯' }; // symbols, not words
const DYING_TIER = 1; // the lowest body tier: about to fall
const TEXT = { fontFamily: 'system-ui, sans-serif', color: '#ffffff', stroke: '#000000', strokeThickness: 3 };

export type Token = {
  fighter: BattleFighter;
  body: Phaser.GameObjects.Container;
  figure: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc;
  hit: Phaser.GameObjects.GameObject; // takes the target click
  ring: Phaser.GameObjects.Ellipse;
  top: number; // height of the figure above the feet
  home: { x: number; y: number }; // the figure's rest spot in its container (sways return here)
  attacks: number;
  art?: CreatureArt; // a foe drawn from its 8 frames
  atlas?: string; // a vice or boss drawn from a character sheet (not the player's)
  wounded?: boolean; // the body is at its lowest tier
};

type Formation = { front: number; back: number };
const atlasKey = actorAssets(PLAYER_ACTOR).atlasKey;
const hasSheet = (scene: Phaser.Scene) => scene.anims.exists(animKey(atlasKey, 'stance_back'));
// Party members face up-right (back poses, as drawn). Foes face down-left (front poses).
const view = (f: BattleFighter) => (f.side === 'party' ? 'back' : 'front');

export function makeToken(scene: Phaser.Scene, f: BattleFighter, formation: Formation): Token {
  const ring = scene.add.ellipse(0, 0, TILE_W * 0.7, TILE_W * 0.32).setStrokeStyle(3, 0xffffff, 0.9).setVisible(false);
  const parts: Phaser.GameObjects.GameObject[] = [ring];
  let figure: Token['figure'];
  let top = RADIUS * 2;
  let creature: ReturnType<typeof makeCreature> = null;
  let atlas: string | undefined;
  const fig = f.side === 'enemy' && f.figure ? makeFigureSprite(scene, f, FIGURE_H) : null;
  if (f.side === 'party' && hasSheet(scene)) {
    const sprite = scene.add.sprite(0, 0, atlasKey); // the back sheet already faces up-right
    sprite.setScale(FIGURE_H / (metaOf(scene, atlasKey).actorHeight ?? 192));
    if (!metaOf(scene, atlasKey).shadow) parts.push(scene.add.ellipse(0, 0, 40, 14, 0x000000, 0.35));
    sprite.setInteractive({ pixelPerfect: false, useHandCursor: true });
    figure = sprite;
    top = FIGURE_H;
  } else if (fig) {
    atlas = fig.atlas;
    if (!fig.shadow) parts.push(scene.add.ellipse(0, 0, 40 * f.figure!.scale, 14, 0x000000, 0.35));
    figure = fig.sprite;
    top = FIGURE_H * f.figure!.scale;
  } else if (hasCreatureArt(f) && (creature = makeCreature(scene, f, FIGURE_H * 0.8))) {
    parts.push(scene.add.ellipse(0, 0, 54, 16, 0x000000, 0.3));
    figure = creature.sprite;
    top = FIGURE_H * 0.8;
  } else {
    const color = f.you ? COLORS.you : f.corrupted ? COLORS.corrupted : COLORS[f.side];
    parts.push(scene.add.ellipse(0, 0, RADIUS * 2.2, RADIUS * 0.7, 0x000000, 0.35));
    figure = scene.add.circle(0, -RADIUS, RADIUS, color).setStrokeStyle(2, 0x1b1b1b);
    figure.setInteractive(new Phaser.Geom.Circle(RADIUS, RADIUS, RADIUS + 14), Phaser.Geom.Circle.Contains);
  }
  parts.push(figure);
  const name = scene.add.text(0, -top - 6, f.name, { ...TEXT, fontSize: '14px', color: f.you ? '#f5d06f' : '#ffffff' }).setOrigin(0.5, 1);
  parts.push(name);
  const body = scene.add.container(0, 0, parts);
  const token: Token = { fighter: f, body, figure, hit: figure, ring, top, home: { x: figure.x, y: figure.y }, attacks: 0, art: creature?.art, atlas };
  place(token, formation);
  pose(token, f.downed ? 'down' : 'stance');
  refresh(token);
  return token;
}

function place(t: Token, formation: Formation): void {
  const p = slotPoint(t.fighter.side, t.fighter.slot, formation);
  t.body.setPosition(p.x, p.y).setDepth(p.depth);
}

// Plays a pose on a sprite figure. One-shot poses fall back to the stance (or stay down).
export function pose(t: Token, name: string): void {
  if (!(t.figure instanceof Phaser.GameObjects.Sprite)) return;
  if (t.art) return creaturePose(t.figure, t.art, name, !!t.wounded && !t.fighter.downed);
  const key = animKey(t.atlas ?? atlasKey, `${name}_${view(t.fighter)}`);
  if (!t.figure.scene.anims.exists(key)) return;
  const sprite = t.figure;
  sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
  sprite.play(key);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    if (!t.fighter.downed) pose(t, 'stance');
  });
}

export function refresh(t: Token): void {
  t.body.setAlpha(t.fighter.downed ? 0.55 : 1);
}

// A body tier changed: the word floats up once (red when the fighter is about to fall).
export function setWord(scene: Phaser.Scene, t: Token, resource: 'hp' | 'stamina' | 'mana', word: Word): void {
  if (resource !== 'hp' && !t.fighter[resource]) return;
  t.fighter[resource] = word;
  const dying = resource === 'hp' && word.tier <= DYING_TIER;
  if (resource === 'hp') t.wounded = dying;
  if (!word.text || t.fighter.downed) return;
  rise(scene, t, word.text, { fontSize: dying ? '16px' : '13px', color: dying ? '#ff7a6a' : '#e8e0cc' }, 1800, 18);
  if (dying) pose(t, 'stagger');
}

// Lays every token on its slot (after a resize the camera refits; positions stay).
export function layout(tokens: Token[], formation: Formation): void {
  for (const t of tokens) place(t, formation);
}

// Slides a token to its new slot after a knockback.
export function moveTo(scene: Phaser.Scene, t: Token, slot: number, row: 'front' | 'back', formation: Formation): void {
  t.fighter.slot = slot;
  t.fighter.row = row;
  const p = slotPoint(t.fighter.side, slot, formation);
  t.body.setDepth(Math.max(t.body.depth, p.depth));
  scene.tweens.add({ targets: t.body, x: p.x, y: p.y, duration: 220, ease: 'Quad.easeOut', onComplete: () => t.body.setDepth(p.depth) });
  pose(t, 'stagger');
}

function rise(scene: Phaser.Scene, t: Token, text: string, style: { fontSize: string; color: string }, ms: number, from = 0): void {
  const label = scene.add.text(t.body.x, t.body.y - t.top - from, text, { ...TEXT, ...style, strokeThickness: 4 })
    .setOrigin(0.5, 1).setDepth(10_000);
  scene.tweens.add({ targets: label, y: label.y - 46, alpha: 0, duration: ms, ease: 'Cubic.easeOut', onComplete: () => label.destroy() });
}

// Damage and healing numbers float up from the fighter (healing in green, crits larger and marked).
export function floatNumber(scene: Phaser.Scene, t: Token, amount: number, kind: 'hit' | 'crit' | 'heal'): void {
  const color = kind === 'heal' ? '#7ee08a' : kind === 'crit' ? '#ffd24a' : '#ff6b5a';
  rise(scene, t, kind === 'crit' ? `${amount}${MARKS.crit}` : String(amount), { fontSize: kind === 'crit' ? '30px' : '22px', color }, 1100);
  if (kind === 'heal') return;
  jolt(scene, t, kind === 'crit' ? 10 : 5);
  if (!t.fighter.downed) pose(t, kind === 'crit' ? 'stagger' : 'hurt');
}

// Away from the foes: the party's back is down-left on screen, the foes' up-right.
const away = (t: Token) => (t.fighter.side === 'party' ? { x: -1, y: 0.5 } : { x: 1, y: -0.5 });

export function jolt(scene: Phaser.Scene, t: Token, px: number): void {
  const d = away(t);
  const base = t.home;
  scene.tweens.killTweensOf(t.figure);
  t.figure.setPosition(base.x, base.y);
  scene.tweens.add({ targets: t.figure, x: base.x + d.x * px, y: base.y + d.y * px, duration: 70, yoyo: true, ease: 'Sine.easeOut' });
}

// A miss: the target sways aside and a mark floats up.
export function dodge(scene: Phaser.Scene, t: Token): void {
  rise(scene, t, MARKS.miss, { fontSize: '20px', color: '#cfcfcf' }, 900);
  pose(t, 'dodge');
  scene.tweens.killTweensOf(t.figure);
  t.figure.setPosition(t.home.x, t.home.y);
  scene.tweens.add({ targets: t.figure, y: t.home.y - 10, duration: 120, yoyo: true, ease: 'Sine.easeOut' });
}

// A counter: the mark floats up from the one who strikes back.
export function counter(scene: Phaser.Scene, t: Token): void {
  rise(scene, t, MARKS.counter, { fontSize: '22px', color: '#9ec5f0' }, 900);
  jolt(scene, t, 8);
}

// The actor steps toward the other side and strikes (punch and kick by turns).
export function lunge(scene: Phaser.Scene, t: Token): void {
  const d = away(t);
  const base = t.home;
  scene.tweens.killTweensOf(t.figure);
  t.figure.setPosition(base.x, base.y);
  scene.tweens.add({ targets: t.figure, x: base.x - d.x * 18, y: base.y - d.y * 18, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
  pose(t, t.attacks++ % 2 ? 'kick' : 'punch');
}

export function fall(t: Token): void {
  t.fighter.downed = true;
  t.ring.setVisible(false);
  pose(t, 'down');
  refresh(t);
}

export function cheer(tokens: Token[]): void {
  for (const t of tokens) if (t.fighter.side === 'party' && !t.fighter.downed) pose(t, 'cheer');
}
