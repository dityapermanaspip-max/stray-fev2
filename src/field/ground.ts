import Phaser from 'phaser';
import type { FieldTileView, FieldView } from '../../../stray-bev1/shared/field.ts';
import { drawOrder, LIFT, surfaceHeight, TILE_H, TILE_W, tileCenter } from './iso.ts';

// Placeholder ground art: colored diamonds with side walls for raised tiles, tilted tops on slopes,
// flat water and swamp, a darker cone on other blocked tiles, a ring on exits. Town buildings are tall blocks
// with a dark door tile in front. Resource nodes get a small mark (rock, tree, herb, fish). Tiles drawn from a sheet
// (ground_tiles.ts) only get their marks here: exit ring, door, node, and the obstacle cone for marker terrains.

const COLORS: Record<string, number> = {
  grass: 0x7fb069, tall_grass: 0x5f9a4f, flowers: 0xc9a3d9, dirt: 0xb08a5a, moss: 0x4f7f4a, leaves: 0xa5793f,
  bush: 0x2f6a3a, rock: 0x8a8a86, tree: 0x1f4d2b, water: 0x4a7fb5, swamp: 0x56603c,
  paving: 0xc9bea4, road: 0xa8946f, building: 0x9a6248, door: 0x4a3024,
  // desert
  sand: 0xe0c98f, dune: 0xd1b06c, cracked_earth: 0xb58f62, cactus: 0x4f8a45, dry_bush: 0x8a7a45,
  // snow
  snow: 0xeef3f6, frost_grass: 0xb7c9b8, ice: 0xbfe0f0, pine: 0x24493a, snow_drift: 0xdfe8ee, frozen_lake: 0x9cc4dc,
  // volcano
  ash: 0x6b6461, basalt: 0x3f3c3d, scorched: 0x5a3d2c, lava_rock: 0x2c2627, obsidian: 0x1d1a24, dead_tree: 0x4a3a2e, lava: 0xe2582a,
  // battlefield
  trampled: 0x9aa063, mud: 0x6f5a3e, wreck: 0x5d4a3a, stakes: 0x7a5d3c,
  // seashore
  wet_sand: 0xbfa877, shingle: 0x9b958a, driftwood: 0x8f7a5e, dune_grass: 0x9fb06a, sea: 0x2f6c9e,
  // rooms (shop, inn, training ground), camp and cave
  floor_wood: 0x9a7048, floor_sand: 0xd2b98a, wall_wood: 0x6b4a32, shelf: 0x7a5538, counter: 0x8a5f3c, hearth: 0x5a4a44,
  table: 0x8d6540, rack: 0x6e5a42, dummy: 0xb89b62, camp_ground: 0x7d8a52, camp_trees: 0x2a5a33, campfire: 0xe0762c, log: 0x74552f,
  cave_floor: 0x59524e, cave_wall: 0x2e2a2c, stalagmite: 0x6d6560,
};
// Blocked terrains drawn as raised blocks (height levels above the floor): walls, furniture. No cone on top.
const RAISED: Record<string, number> = {
  wall_wood: 2.5, cave_wall: 2.5, camp_trees: 2, shelf: 1.6, hearth: 1.4, counter: 0.9, table: 0.8, rack: 1.4, dummy: 1.2,
  campfire: 0.4, log: 0.5, stalagmite: 1.4,
};
const BUILDING_LIFT = 2.5; // height levels a building block stands above its tile (drawing only)
const FLAT_OBSTACLES = new Set(['water', 'swamp', 'building', 'frozen_lake', 'lava', 'sea', ...Object.keys(RAISED)]); // blocked, but no cone
const FALLBACK = 0x999999;

// Tiles already drawn from a tile sheet; marker = keep the obstacle mark on top, node = the sprite shows the node.
export type SpriteGround = Map<number, { marker: boolean; node: boolean }>;
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

// Height of each top corner: flat tiles are level; a slope runs from its low edge h up one level in its direction.
function cornerHeights(tile: FieldTileView): number[] {
  const lift = tile.t === 'building' ? BUILDING_LIFT : RAISED[tile.t];
  if (lift) return CORNERS.map(() => tile.h + lift);
  if (tile.s < 0) return CORNERS.map(() => tile.h);
  const [ux, uy] = SLOPE_DIRS[tile.s];
  return CORNERS.map((c) => tile.h + 0.5 + (c.gx * ux + c.gy * uy));
}

// A resource node's mark, standing on its tile: a boulder, a stump with a crown, a herb tuft, or ripples.
function drawNode(g: Phaser.GameObjects.Graphics, mid: { x: number; y: number }, kind: string): void {
  g.fillStyle(0x000000, 0.25).fillEllipse(mid.x, mid.y + 2, 22, 8); // shadow
  if (kind === 'rock') {
    g.fillStyle(0x7d7a74).fillEllipse(mid.x, mid.y - 5, 20, 14);
    g.fillStyle(0xb9b2a4).fillEllipse(mid.x - 3, mid.y - 8, 8, 5);
  } else if (kind === 'tree') {
    g.fillStyle(0x6b4a2e).fillRect(mid.x - 3, mid.y - 14, 6, 14);
    g.fillStyle(0x2f6a3a).fillCircle(mid.x, mid.y - 20, 10);
  } else if (kind === 'herb') {
    g.fillStyle(0x4f9a45);
    for (const dx of [-6, 0, 6]) g.fillTriangle(mid.x + dx - 3, mid.y, mid.x + dx + 3, mid.y, mid.x + dx, mid.y - 12);
    g.fillStyle(0xd9a3e0).fillCircle(mid.x, mid.y - 12, 2.5);
  } else if (kind === 'camp') {
    g.fillStyle(0x7a5a3a).fillTriangle(mid.x - 14, mid.y, mid.x + 14, mid.y, mid.x, mid.y - 22);
    g.fillStyle(0x2b2118).fillTriangle(mid.x - 4, mid.y, mid.x + 4, mid.y, mid.x, mid.y - 11);
    g.fillStyle(0xe0762c).fillCircle(mid.x + 16, mid.y - 3, 4);
  } else if (kind === 'cave') {
    g.fillStyle(0x5b5550).fillEllipse(mid.x, mid.y - 8, 34, 24);
    g.fillStyle(0x0d0b0c).fillEllipse(mid.x, mid.y - 5, 20, 16);
  } else {
    g.lineStyle(2, 0xdbeefa, 0.9).strokeEllipse(mid.x, mid.y, 18, 7).strokeEllipse(mid.x, mid.y, 30, 12);
  }
}

function drawTile(
  g: Phaser.GameObjects.Graphics, x: number, y: number, tile: FieldTileView, exit: boolean, node: string | null,
  sprite?: { marker: boolean; node: boolean },
): void {
  const color = COLORS[tile.t] ?? FALLBACK;
  if (sprite) return drawMarks(g, tileCenter(x, y, surfaceHeight(tile)), tile, exit, sprite.node ? null : node, sprite.marker);
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
  drawMarks(g, tileCenter(x, y, surfaceHeight(tile)), tile, exit, node, !tile.w && !node && !FLAT_OBSTACLES.has(tile.t)); // a node is its own obstacle
}

// What stands on a tile: the obstacle cone, a doorstep, the exit ring, a resource node.
function drawMarks(g: Phaser.GameObjects.Graphics, mid: { x: number; y: number }, tile: FieldTileView, exit: boolean, node: string | null, cone: boolean): void {
  if (cone) {
    g.fillStyle(shade(COLORS[tile.t] ?? FALLBACK, 0.6));
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
  if (node) drawNode(g, mid, node);
}

// One Graphics per diagonal row, so players can stand between rows in depth.
// `skip`: tiles something else draws (town buildings).
export function drawGround(scene: Phaser.Scene, view: FieldView, sprited: SpriteGround = new Map(), skip = new Set<number>()): Phaser.GameObjects.Graphics[] {
  const rows = new Map<number, Phaser.GameObjects.Graphics>();
  const exits = new Set(view.exits.map((e) => e.y * view.width + e.x));
  const nodes = new Map(view.nodes.map((n) => [n.y * view.width + n.x, n.kind]));
  for (const i of drawOrder(view)) {
    if (skip.has(i)) continue;
    const x = i % view.width;
    const y = Math.floor(i / view.width);
    let g = rows.get(x + y);
    if (!g) {
      g = scene.add.graphics().setDepth((x + y) * 10);
      rows.set(x + y, g);
    }
    drawTile(g, x, y, view.tiles[i], exits.has(i), nodes.get(i) ?? null, sprited.get(i));
  }
  return [...rows.values()];
}
