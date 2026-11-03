import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { findBlobs, flatPivot, joinSpecks, measure, median, mergeOverlapping, readingOrder, splitTouching } from './blobs.ts';
import { crop, flipX, resize, type Frame } from './image.ts';
import { readPng } from './png.ts';

// Reading tile sheets (shared by slice.ts, the per-biome slicer, and catalog.ts, the catalog slicer): a PNG of
// isometric tiles on a transparent background, 3 x 5 (ground) or 3 x 2 (objects), a frame name per tile in reading
// order (rows by the tiles' feet, left to right; null skips). Tiles are scaled to one tile width; each frame's pivot
// is its top-face centre.

export const TILE_PX = 144; // atlas tile width; the client scales it to TILE_W
const PAD = 2;
const LAYOUTS = [64, 15, 12, 9, 6, 5]; // tiles per sheet: 8 x 8 generated set, 3 x 5 ground, 3 x 4 scenes, 3 x 3 big obstacles, 3 x 2 objects

export type Sheet = { file: string; names: (string | null)[] };
export type Source = Frame & { wall: number }; // wall: side wall height in atlas pixels

export async function readSheet(dir: string, sheet: Sheet, frames: Map<string, Source>): Promise<string> {
  if (!LAYOUTS.includes(sheet.names.length)) throw new Error(`${sheet.file}: name 64, 15, 12, 9, 6 or 5 tiles, not ${sheet.names.length}`);
  const img = readPng(new Uint8Array(await readFile(path.join(dir, sheet.file))));
  const joined = mergeOverlapping(joinSpecks(findBlobs(img)));
  let tiles = readingOrder(splitTouching(img, joined));
  if (tiles.length < sheet.names.length) tiles = readingOrder(splitTouching(img, joined, 45)); // a tile under a pole or banner
  if (tiles.length !== sheet.names.length) {
    throw new Error(`${sheet.file}: found ${tiles.length} tiles, the table names ${sheet.names.length}`);
  }
  const measures = tiles.map((b) => measure(img, b));
  const width = median(measures.map((m) => m.width));
  const wall = median(measures.map((m) => m.wall));
  const scale = TILE_PX / width;
  tiles.forEach((b, i) => {
    const name = sheet.names[i];
    if (!name) return;
    if (frames.has(name)) throw new Error(`${sheet.file}: frame ${name} named twice`);
    const x = Math.max(0, b.x0 - PAD), y = Math.max(0, b.y0 - PAD);
    const w = Math.min(img.width, b.x1 + PAD + 1) - x, h = Math.min(img.height, b.y1 + PAD + 1) - y;
    const pivot = flatPivot(measures[i], wall, width);
    const small = resize(crop(img, x, y, w, h), Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)));
    frames.set(name, { img: small, pivot: { x: (pivot.x - x) * scale, y: (pivot.y - y) * scale }, wall: wall * scale });
  });
  return `${sheet.file}: ${tiles.length} tiles, width ${width}px, wall ${wall}px`;
}

export function makeMirrors(mirror: Record<string, string>, frames: Map<string, Source>): number {
  for (const [name, from] of Object.entries(mirror)) {
    const src = frames.get(from);
    if (!src) throw new Error(`mirror.${name}: no frame ${from}`);
    if (frames.has(name)) throw new Error(`mirror.${name}: frame already exists`);
    frames.set(name, { img: flipX(src.img), pivot: { x: src.img.width - src.pivot.x, y: src.pivot.y }, wall: src.wall });
  }
  return Object.keys(mirror).length;
}
