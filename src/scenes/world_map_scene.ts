import Phaser from 'phaser';
import type { MapHex, MapView } from '../../../stray-bev1/shared/map.ts';
import { SceneKeys } from '../keys.ts';
import { BIOME_COLORS, FOG_COLOR, UNKNOWN_BIOME, fitSize, hexCorners, hexToPixel, pixelToHex, type Px } from '../map/hex_math.ts';

// The world map, over the field. It draws only what the server sent: visited hexes in full colour (towns marked),
// glimpsed ones faded, fog dark. A gold ring marks where the player stands; in a corridor, a dot on the line
// between its two hexes. Hover (or tap) a known hex for its name. ✕ closes it; the field scene owns the keys (M, Esc).

export type WorldMapData = { view: MapView };
export const MAP_CLOSED = 'map-closed'; // emitted on this scene's events when it closes

const PANEL = 0x0b0d10;
const HERE = 0xf5d06f;

export class WorldMapScene extends Phaser.Scene {
  private view!: MapView;
  private size = 20;
  private label?: Phaser.GameObjects.Text;
  private board?: Phaser.GameObjects.Container;

  constructor() {
    super(SceneKeys.WorldMap);
  }

  create(data: WorldMapData): void {
    this.view = data.view;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.draw, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.hover, this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.hover, this);
    this.draw();
  }

  private draw(): void {
    this.children.removeAll(true);
    const { width: w, height: h } = this.scale;
    this.add.rectangle(0, 0, w, h, PANEL, 0.88).setOrigin(0).setInteractive(); // swallows clicks meant for the field
    const rings = Math.max(1, ...this.view.hexes.map((x) => (Math.abs(x.q) + Math.abs(x.r) + Math.abs(x.q + x.r)) / 2));
    this.size = fitSize(rings, w, h - 60);
    const g = this.add.graphics();
    for (const hex of this.view.hexes) this.paint(g, hex);
    this.board = this.add.container(w / 2, (h - 20) / 2, [g, ...this.marks()]);
    this.label = this.add.text(w / 2, h - 18, '', {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#f2ead8', backgroundColor: '#000000aa', padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 1).setVisible(false);
    this.add.text(16, 16, '✕', { fontFamily: 'system-ui, sans-serif', fontSize: '26px', color: '#f2ead8' }) // top-right holds the DOM buttons
      .setOrigin(0, 0).setInteractive({ useHandCursor: true }).on(Phaser.Input.Events.POINTER_DOWN, this.close, this);
  }

  private paint(g: Phaser.GameObjects.Graphics, hex: MapHex): void {
    const c = hexToPixel(hex.q, hex.r, this.size);
    const pts = hexCorners(c, this.size * 0.96).map((p) => new Phaser.Math.Vector2(p.x, p.y));
    const color = hex.seen === 'fog' ? FOG_COLOR : BIOME_COLORS[hex.biome ?? ''] ?? UNKNOWN_BIOME;
    g.fillStyle(color, hex.seen === 'glimpsed' ? 0.45 : 1).fillPoints(pts, true);
    g.lineStyle(1, 0x000000, 0.6).strokePoints(pts, true);
    if (hex.town) {
      const s = this.size * 0.32;
      g.fillStyle(0x3a2a1e, 1).fillRect(c.x - s / 2, c.y - s / 3, s, s * 0.7);
      g.fillTriangle(c.x - s * 0.65, c.y - s / 3, c.x + s * 0.65, c.y - s / 3, c.x, c.y - s);
    }
  }

  // Where the player is: a ring on their hex, or a dot on the way between two hexes.
  private marks(): Phaser.GameObjects.GameObject[] {
    const { here, between } = this.view;
    if (here) {
      const c = hexToPixel(here.q, here.r, this.size);
      return [this.add.circle(c.x, c.y, this.size * 0.5).setStrokeStyle(3, HERE)];
    }
    if (!between) return [];
    const a = hexToPixel(between.from.q, between.from.r, this.size);
    const b = hexToPixel(between.to.q, between.to.r, this.size);
    const t = (between.step - 0.5) / between.steps;
    const at: Px = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    return [
      this.add.line(0, 0, a.x, a.y, b.x, b.y, HERE, 0.6).setOrigin(0).setLineWidth(2),
      this.add.circle(at.x, at.y, Math.max(4, this.size * 0.18), HERE).setStrokeStyle(2, 0x000000),
    ];
  }

  private hover(p: Phaser.Input.Pointer): void {
    if (!this.board || !this.label) return;
    const { q, r } = pixelToHex(p.x - this.board.x, p.y - this.board.y, this.size);
    const hex = this.view.hexes.find((x) => x.q === q && x.r === r);
    this.label.setText(hex?.name ?? '').setVisible(!!hex?.name);
  }

  private close(): void {
    this.events.emit(MAP_CLOSED);
    this.scene.stop();
  }

  private onShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.draw, this);
  }
}
