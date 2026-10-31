import Phaser from 'phaser';
import type { BattleFighter, Word } from '../../../stray-bev1/shared/battle.ts';

// Placeholder fighters: a token per fighter in two rows per side, the name above it and body words below.
// Party on the left, foes on the right; front rows face each other. Real sprites replace the tokens later.

const COLORS = { you: 0xf5d06f, party: 0x9ec5f0, enemy: 0xd98c6a, corrupted: 0x8e5bb5 };
const RADIUS = 26;
const GAP_Y = 110;
const COLUMN = { party: { front: 0.38, back: 0.24 }, enemy: { front: 0.62, back: 0.76 } };
const TEXT = { fontFamily: 'system-ui, sans-serif', color: '#ffffff', stroke: '#000000', strokeThickness: 3 };

export type Token = {
  fighter: BattleFighter;
  body: Phaser.GameObjects.Container;
  disc: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  words: Phaser.GameObjects.Text;
};

const wordLine = (f: BattleFighter) => [f.hp, f.stamina, f.mana].filter((w): w is Word => !!w && !!w.text).map((w) => w.text).join(' · ');

export function makeToken(scene: Phaser.Scene, f: BattleFighter): Token {
  const color = f.you ? COLORS.you : f.corrupted ? COLORS.corrupted : COLORS[f.side];
  const shadow = scene.add.ellipse(0, RADIUS, RADIUS * 2.2, RADIUS * 0.7, 0x000000, 0.35);
  const ring = scene.add.circle(0, 0, RADIUS + 6).setStrokeStyle(3, 0xffffff, 0.9).setVisible(false);
  const disc = scene.add.circle(0, 0, RADIUS, color).setStrokeStyle(2, 0x1b1b1b);
  const name = scene.add.text(0, -RADIUS - 8, f.name, { ...TEXT, fontSize: '14px' }).setOrigin(0.5, 1);
  const words = scene.add.text(0, RADIUS + 12, '', { ...TEXT, fontSize: '12px', color: '#e8e0cc' }).setOrigin(0.5, 0);
  const body = scene.add.container(0, 0, [shadow, ring, disc, name, words]);
  disc.setInteractive(new Phaser.Geom.Circle(RADIUS, RADIUS, RADIUS + 14), Phaser.Geom.Circle.Contains);
  const token = { fighter: f, body, disc, ring, words };
  refresh(token);
  return token;
}

export function refresh(t: Token): void {
  t.words.setText(wordLine(t.fighter));
  t.body.setAlpha(t.fighter.downed ? 0.35 : 1);
}

export function setWord(t: Token, resource: 'hp' | 'stamina' | 'mana', word: Word): void {
  if (resource !== 'hp' && !t.fighter[resource]) return;
  t.fighter[resource] = word;
  refresh(t);
}

// Places every token by side and row, centred vertically.
export function layout(scene: Phaser.Scene, tokens: Token[]): void {
  const { width, height } = scene.scale;
  for (const side of ['party', 'enemy'] as const) {
    for (const row of ['front', 'back'] as const) {
      const group = tokens.filter((t) => t.fighter.side === side && t.fighter.row === row);
      group.forEach((t, i) => {
        const y = height * 0.42 + (i - (group.length - 1) / 2) * GAP_Y;
        t.body.setPosition(width * COLUMN[side][row], y);
      });
    }
  }
}

// Damage and healing numbers float up from the fighter (healing in green, crits larger).
export function floatNumber(scene: Phaser.Scene, t: Token, amount: number, kind: 'hit' | 'crit' | 'heal'): void {
  const color = kind === 'heal' ? '#7ee08a' : kind === 'crit' ? '#ffd24a' : '#ff6b5a';
  const size = kind === 'crit' ? '30px' : '22px';
  const label = scene.add.text(t.body.x, t.body.y - RADIUS, String(amount), { ...TEXT, fontSize: size, color, strokeThickness: 4 })
    .setOrigin(0.5, 1).setDepth(10);
  scene.tweens.add({ targets: label, y: label.y - 50, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => label.destroy() });
  if (kind !== 'heal') jolt(scene, t, kind === 'crit' ? 10 : 5);
}

export function jolt(scene: Phaser.Scene, t: Token, px: number): void {
  const dir = t.fighter.side === 'party' ? -1 : 1;
  scene.tweens.add({ targets: t.disc, x: dir * px, duration: 70, yoyo: true, ease: 'Sine.easeOut' });
}

// A miss: the target sways aside.
export function dodge(scene: Phaser.Scene, t: Token): void {
  scene.tweens.add({ targets: t.disc, y: -12, duration: 120, yoyo: true, ease: 'Sine.easeOut' });
}

// The actor steps toward the other side when its move lands.
export function lunge(scene: Phaser.Scene, t: Token): void {
  const dir = t.fighter.side === 'party' ? 1 : -1;
  scene.tweens.add({ targets: t.disc, x: dir * 18, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
}
