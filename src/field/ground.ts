import Phaser from 'phaser';
import type { FieldTileView, FieldView } from '../../../stray-bev1/shared/field.ts';
import { drawOrder, LIFT, TILE_H, TILE_W, tileCenter } from './iso.ts';

// Placeholder ground art: colored diamonds with side walls for raised tiles, tilted tops on slopes,
// flat water and swamp, a darker cone on other blocked tiles, a ring on exits. Town buildings are tall blocks
// with a dark door tile in front. Real tiles replace this later.

const COLORS: Record<string, number> = {
  grass: 0x7fb069, tall_grass: 0x5f9a4f, flowers: 0xc9a3d9, dirt: 0xb08a5a, moss: 0x4f7f4a, leaves: 0xa5793f,
  bush: 0x2f6a3a, rock: 0x8a8a86, tree: 0x1f4d2b, water: 0x4a7fb5, swamp: 0x56603c,
  paving: 0xc9bea4, road: 0xa8946f, building: 0x9a6248, door: 0x4a3024,
};
const BUILDING_LIFT = 2.5; // height levels a building block stands above its tile (drawing only)
const FLAT_OBSTACLES = new Set(['water', 'swamp', 'building']); // blocked, but no cone
const FALLBACK = 0x999999;
const EXIT_COLOR = 0xf2e7c4;
const SLOPE_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // matches the server's uphill directions
// Corners of a tile's top face in grid offsets and screen offsets: top, right, bottom, left.
const CORNERS = [
  { gx: -0.5, gy: -0.5, sx: 0, sy: -TILE_H / 2 },
  { gx: 0.5, gy: -0.5, sx: TILE_W / 2, sy: 0 },
  { gx: 0.5, gy: 0.5, sx: 0, sy: TILE_H / 2 },
  { gx: -0.5, gy: 0.5, sx: -TILE_W / 2, sy: 0 },
];

function shade(color: number, factor: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const f = (v: number) => Math.min(255, v * factor);
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}

// Height of each top corner: flat tiles are level, slopes run one level below to one above.
function cornerHeights(tile: FieldTileView): number[] {
  if (tile.t === 'building') return CORNERS.map(() => tile.h + BUILDING_LIFT);
  if (tile.s < 0) return CORNERS.map(() => tile.h);
  const [ux, uy] = SLOPE_DIRS[tile.s];
  return CORNERS.map((c) => tile.h + 2 * (c.gx * ux + c.gy * uy));
}

function drawTile(g: Phaser.GameObjects.Graphics, x: number, y: number, tile: FieldTileView, exit: boolean): void {
  const color = COLORS[tile.t] ?? FALLBACK;
  const base = tileCenter(x, y, 0);
  const heights = cornerHeights(tile);
  const top = CORNERS.map((c, i) => new Phaser.Math.Vector2(base.x + c.sx, base.y + c.sy - heights[i] * LIFT));
  const foot = (i: number) => new Phaser.Math.Vector2(base.x + CORNERS[i].sx, base.y + CORNERS[i].sy);
  if (heights.some((h) => h > 0)) {
    g.fillStyle(shade(color, 0.5));
    g.fillPoints([top[3], top[2], foot(2), foot(3)], true); // left face
    g.fillStyle(shade(color, 0.65));
    g.fillPoints([top[2], top[1], foot(1), foot(2)], true); // right face
  }
  const lit = tile.s < 0 ? 1 : tile.s < 2 ? 0.88 : 1.1; // slopes catch the light by facing
  g.fillStyle(shade(tile.w || FLAT_OBSTACLES.has(tile.t) ? color : shade(color, 0.8), lit));
  g.fillPoints(top, true);
  g.lineStyle(1, shade(color, 0.7), 0.6);
  g.strokePoints(top, true);
  const mid = tileCenter(x, y, tile.h);
  if (!tile.w && !FLAT_OBSTACLES.has(tile.t)) {
    g.fillStyle(shade(color, 0.6));
    g.fillTriangle(mid.x - 12, mid.y + 4, mid.x + 12, mid.y + 4, mid.x, mid.y - 26);
  }
  if (tile.door) {
    g.fillStyle(0xf2e7c4, 0.9);
    g.fillRect(mid.x - 5, mid.y - 4, 10, 6); // a lit doorstep
  }
  if (exit) {
    g.lineStyle(2, EXIT_COLOR, 0.9);
    g.strokeEllipse(mid.x, mid.y, TILE_W * 0.6, TILE_H * 0.6);
  }
}

// One Graphics per diagonal row, so players can stand between rows in depth.
export function drawGround(scene: Phaser.Scene, view: FieldView): Phaser.GameObjects.Graphics[] {
  const rows = new Map<number, Phaser.GameObjects.Graphics>();
  const exits = new Set(view.exits.map((e) => e.y * view.width + e.x));
  for (const i of drawOrder(view)) {
    const x = i % view.width;
    const y = Math.floor(i / view.width);
    let g = rows.get(x + y);
    if (!g) {
      g = scene.add.graphics().setDepth((x + y) * 10);
      rows.set(x + y, g);
    }
    drawTile(g, x, y, view.tiles[i], exits.has(i));
  }
  return [...rows.values()];
}
