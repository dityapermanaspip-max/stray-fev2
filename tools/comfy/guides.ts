import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { writePng, type Rgba } from '../tiles/png.ts';
import type { Footprint } from './template.ts';

// Layout guides for tiles whose picture must be laid out in a set way (an edge on one side, a path that connects two
// sides). Text cannot place things, so each guide is a flat-colour painting of the tile's top face, from the tile's own
// footprint; the workflow starts from it (img2img) and the LoRA paints the look over it.
// Grid coordinates gx, gy run -0.5 .. 0.5 over the top face, like the game: +gx is the bottom right edge, -gx top left,
// +gy bottom left, -gy top right. A boundary wobbles a little so it does not look ruled.

export type Rgb = [number, number, number];
export type Palette = { wall: Rgb; layers: Record<string, [Rgb, Rgb]>; edges: string[] }; // layers: key prefix -> [ground, what is laid on it]; edges: prefixes whose corner keys are patches, not path bends
const BACKDROP: Rgb = [128, 128, 128];
type Pt = [number, number];
type Layout = (gx: number, gy: number) => Rgb;

const wobble = (gx: number, gy: number) => 0.04 * Math.sin(gx * 17 + gy * 9) + 0.03 * Math.sin(gx * 7 - gy * 13);
const near = (gx: number, gy: number, [px, py]: Pt) => Math.hypot(gx - px, gy - py);
function toSegment(gx: number, gy: number, [ax, ay]: Pt, [bx, by]: Pt): number {
  const t = Math.max(0, Math.min(1, ((gx - ax) * (bx - ax) + (gy - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  return Math.hypot(gx - (ax + t * (bx - ax)), gy - (ay + t * (by - ay)));
}

const EDGE: Record<string, (gx: number, gy: number) => number> = { // > 0 is dirt
  bl: (gx, gy) => gy - 0.12, br: (gx) => gx - 0.12, tl: (gx) => -gx - 0.12, tr: (_, gy) => -gy - 0.12,
};
const CORNER: Record<string, Pt> = { b: [0.5, 0.5], t: [-0.5, -0.5], l: [-0.5, 0.5], r: [0.5, -0.5] };
const PATH: Record<string, Pt[][]> = {
  straight_x: [[[-0.5, 0], [0.5, 0]]], straight_y: [[[0, -0.5], [0, 0.5]]],
  corner_t: [[[-0.5, 0], [0, 0], [0, -0.5]]], corner_r: [[[0, -0.5], [0, 0], [0.5, 0]]],
  corner_b: [[[0.5, 0], [0, 0], [0, 0.5]]], corner_l: [[[0, 0.5], [0, 0], [-0.5, 0]]],
  cross: [[[-0.5, 0], [0.5, 0]], [[0, -0.5], [0, 0.5]]], end: [[[-0.5, 0], [0, 0]]],
};
const PATH_HALF = 0.16;

// Keys are <prefix>_edge_<bl|br|tl|tr>, <prefix>_corner_<b|t|l|r> and <prefix>_<path shape>; the prefix picks the colours.
export function layoutFor(key: string, pal: Palette): Layout | null {
  const [ground, other] = pal.layers[key.split('_')[0]] ?? [];
  if (!ground) return null;
  const edge = key.match(/_edge_(bl|br|tl|tr)$/)?.[1];
  if (edge) return (gx, gy) => (EDGE[edge](gx, gy) + wobble(gx, gy) > 0 ? other : ground);
  const corner = key.match(/_corner_([btlr])$/)?.[1];
  if (corner && pal.edges.includes(key.split('_')[0])) return (gx, gy) => (near(gx, gy, CORNER[corner]) < 0.45 + wobble(gx, gy) ? other : ground);
  const shape = key.slice(key.indexOf('_') + 1);
  if (PATH[shape]) {
    const lines = PATH[shape];
    return (gx, gy) => (Math.min(...lines.flatMap((l) => l.slice(1).map((p, i) => toSegment(gx, gy, l[i], p)))) < PATH_HALF + wobble(gx, gy) * 0.6 ? other : ground);
  }
  return null;
}

// Value noise at two scales, so the guide carries texture and a low denoise keeps it (flat colours came out flat).
const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const grain = (x: number, y: number) => (hash(Math.floor(x / 2), Math.floor(y / 2)) - 0.5) * 44 + (hash(Math.floor(x / 7), Math.floor(y / 5)) - 0.5) * 36;

// True for the side wall: on the tile but outside the top diamond (with a margin, so the top face keeps its own outline).
export function isWall(fp: Footprint, x: number, y: number, margin = 0.04): boolean {
  if (!fp.inside[y * fp.w + x]) return false;
  const sx = (x - fp.cx) / fp.half, sy = (y - fp.cy) / (fp.half / 2);
  return Math.abs((sx + sy) / 2) > 0.5 + margin || Math.abs((sy - sx) / 2) > 0.5 + margin;
}

// Paints the layout on the footprint: the top face by the layout, the wall brown, the rest the flat backdrop.
export function paint(fp: Footprint, layout: Layout, wall: Rgb): Rgba {
  const out: Rgba = { width: fp.w, height: fp.h, data: new Uint8Array(fp.w * fp.h * 4).fill(255) };
  const quarter = fp.half / 2;
  for (let y = 0; y < fp.h; y++) {
    for (let x = 0; x < fp.w; x++) {
      const sx = (x - fp.cx) / fp.half, sy = (y - fp.cy) / quarter;
      const gx = (sx + sy) / 2, gy = (sy - sx) / 2;
      const colour = !fp.inside[y * fp.w + x] ? BACKDROP : Math.abs(gx) <= 0.5 && Math.abs(gy) <= 0.5 ? (layout(gx, gy).map((c) => Math.max(0, Math.min(255, c + grain(x, y)))) as Rgb) : wall;
      out.data.set(colour, (y * fp.w + x) * 4);
    }
  }
  return out;
}

export async function writeGuide(dir: string, key: string, fp: Footprint, pal: Palette): Promise<string | null> {
  const layout = layoutFor(key, pal);
  if (!layout) return null;
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${key}.png`);
  await writeFile(file, writePng(paint(fp, layout, pal.wall)));
  return file;
}
