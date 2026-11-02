import type { FieldView } from '../../../stray-bev1/shared/field.ts';

// Isometric projection for field tiles. Height only lifts tiles visually (the climbing rule is the server's).

export const TILE_W = 96; // tile sheets are scaled to this (their diamonds are 2:1)
export const TILE_H = 48;
export const LIFT = 10; // pixels per height step

export type Point = { x: number; y: number };

// Height of the middle of a tile's top face: a slope (s >= 0) rises one level from its low edge h, so half a level up.
export const surfaceHeight = (t: { h: number; s: number }) => t.h + (t.s >= 0 ? 0.5 : 0);

// Center of the tile's top face, in world pixels.
export function tileCenter(x: number, y: number, height: number): Point {
  return { x: (x - y) * (TILE_W / 2), y: (x + y) * (TILE_H / 2) - height * LIFT };
}

function inDiamond(px: number, py: number, c: Point): boolean {
  return Math.abs(px - c.x) / (TILE_W / 2) + Math.abs(py - c.y) / (TILE_H / 2) <= 1;
}

// The tile whose top face is under a world point. Front tiles (drawn last) win.
export function pickTile(view: FieldView, px: number, py: number): Point | null {
  for (let i = view.tiles.length - 1; i >= 0; i--) {
    const x = i % view.width;
    const y = Math.floor(i / view.width);
    if (inDiamond(px, py, tileCenter(x, y, surfaceHeight(view.tiles[i])))) return { x, y };
  }
  return null;
}

// Draw order: back to front, so tiles nearer the camera cover the ones behind.
export function drawOrder(view: FieldView): number[] {
  const order = view.tiles.map((_, i) => i);
  return order.sort((a, b) => {
    const sa = (a % view.width) + Math.floor(a / view.width);
    const sb = (b % view.width) + Math.floor(b / view.width);
    return sa - sb || a - b;
  });
}

// Depth for sprites standing on a tile, above that tile's ground.
export function depthAt(x: number, y: number): number {
  return (x + y) * 10 + 5;
}
