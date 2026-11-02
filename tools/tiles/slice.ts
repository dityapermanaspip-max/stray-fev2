import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LIFT, TILE_W } from '../../src/field/iso.ts';
import { findBlobs, flatPivot, joinSpecks, measure, median, mergeOverlapping, readingOrder, splitTouching } from './blobs.ts';
import { crop, flipX, resize } from './image.ts';
import { pack } from './pack.ts';
import { readPng, writePng } from './png.ts';
import { slopeFrom, type Frame } from './skew.ts';

// npm run tiles:slice -- <biome> [more biomes]
// Reads the sheets listed in public/assets/world/tiles/<biome>/<biome>.tiles.json. Each sheet is a PNG of isometric
// tiles on a transparent background in one of two layouts: 3 x 5 (ground) or 3 x 2 (objects); `names` gives a frame
// name per tile in reading order (rows by the tiles' feet, left to right), null skips a tile. Tiles are scaled to one tile width, slopes are
// made from flat frames (skew.ts) in all four directions, and everything is packed into <biome>_atlas.png with the
// Phaser atlas <biome>.json. Each frame's pivot is its top-face centre.
// `slopes`: group -> source frames, either a list (every direction) or { x, y } (frames for slopes along each axis,
// for paths). Frames come out as <biome>_<group>_<side>_NN, side dr/dl/ul/ur for server slope 0/1/2/3.
// `mirror`: new frame -> frame to mirror left-right (swaps the grid axes: a shore facing -x then faces -y). Mirrors are
// made before slopes, so a mirror can feed a slope.
// Then it checks the use table: every frame it names must exist; frames it never uses are listed.

const TILE_PX = 144; // atlas tile width; the client scales it to TILE_W
const LEVEL_PX = (TILE_PX * LIFT) / TILE_W; // one height level in atlas pixels
const PAD = 2;
const LAYOUTS = [15, 6]; // tiles per sheet: 3 x 5 ground, 3 x 2 objects
const SIDES = ['dr', 'dl', 'ul', 'ur'];
const LIGHT = [0.88, 0.88, 1.1, 1.1]; // the face's light by uphill direction, as the plain-colour ground does
const root = path.resolve(import.meta.dirname, '../../public/assets/world/tiles');

type Sheet = { file: string; names: (string | null)[] };
type Slopes = Record<string, string[] | { x: string[]; y: string[] }>;
type Table = { sheets: Sheet[]; slopes?: Slopes; mirror?: Record<string, string>; [key: string]: unknown };
type Source = Frame & { wall: number }; // wall: side wall height in atlas pixels

const num = (n: number) => String(n).padStart(2, '0');

// Every string in the use table that looks like a frame name of this biome.
function namedFrames(biome: string, table: unknown): string[] {
  if (typeof table === 'string') return table.startsWith(`${biome}_`) ? [table] : [];
  if (Array.isArray(table)) return table.flatMap((v) => namedFrames(biome, v));
  if (table && typeof table === 'object') return Object.values(table).flatMap((v) => namedFrames(biome, v));
  return [];
}

async function readSheet(dir: string, sheet: Sheet, frames: Map<string, Source>): Promise<string> {
  if (!LAYOUTS.includes(sheet.names.length)) throw new Error(`${sheet.file}: name 15 tiles (3 x 5) or 6 (3 x 2), not ${sheet.names.length}`);
  const img = readPng(new Uint8Array(await readFile(path.join(dir, sheet.file))));
  const tiles = readingOrder(splitTouching(img, mergeOverlapping(joinSpecks(findBlobs(img)))));
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

function makeMirrors(mirror: Record<string, string>, frames: Map<string, Source>): number {
  for (const [name, from] of Object.entries(mirror)) {
    const src = frames.get(from);
    if (!src) throw new Error(`mirror.${name}: no frame ${from}`);
    if (frames.has(name)) throw new Error(`mirror.${name}: frame already exists`);
    frames.set(name, { img: flipX(src.img), pivot: { x: src.img.width - src.pivot.x, y: src.pivot.y }, wall: src.wall });
  }
  return Object.keys(mirror).length;
}

function makeSlopes(biome: string, slopes: Slopes, frames: Map<string, Source>): number {
  let made = 0;
  for (const [group, spec] of Object.entries(slopes)) {
    for (let dir = 0; dir < 4; dir++) {
      const sources = Array.isArray(spec) ? spec : dir % 2 === 0 ? spec.x : spec.y;
      sources.forEach((name, i) => {
        const src = frames.get(name);
        if (!src) throw new Error(`slopes.${group}: no frame ${name}`);
        frames.set(`${biome}_${group}_${SIDES[dir]}_${num(i + 1)}`, slopeFrom(src, TILE_PX, src.wall, LEVEL_PX, dir, LIGHT[dir]) as Source);
        made++;
      });
    }
  }
  return made;
}

async function slice(biome: string): Promise<void> {
  const dir = path.join(root, biome);
  const table = JSON.parse(await readFile(path.join(dir, `${biome}.tiles.json`), 'utf8')) as Table;
  if (!Array.isArray(table.sheets) || table.sheets.length === 0) throw new Error(`${biome}.tiles.json: no sheets`);
  const frames = new Map<string, Source>();
  for (const sheet of table.sheets) console.log(`  ${await readSheet(dir, sheet, frames)}`);
  const mirrors = makeMirrors(table.mirror ?? {}, frames);
  const slopes = makeSlopes(biome, table.slopes ?? {}, frames);

  const { image, json } = pack(frames);
  const imageFile = `${biome}_atlas.png`;
  await writeFile(path.join(dir, imageFile), writePng(image));
  const meta = { app: 'stray-fev2 tools/tiles/slice.ts', image: imageFile, size: { w: image.width, h: image.height }, scale: '1', tileWidth: TILE_PX };
  await writeFile(path.join(dir, `${biome}.json`), JSON.stringify({ frames: json, meta }, null, 1) + '\n');

  const { sheets: _s, slopes: _l, mirror: _m, ...uses } = table;
  const named = new Set(namedFrames(biome, uses));
  const missing = [...named].filter((n) => !frames.has(n));
  const sourced = new Set([
    ...Object.values(table.slopes ?? {}).flatMap((s) => (Array.isArray(s) ? s : [...s.x, ...s.y])), ...Object.values(table.mirror ?? {}),
  ]);
  const unused = [...frames.keys()].filter((n) => !named.has(n) && !sourced.has(n) && !/_(dr|dl|ul|ur)_\d+$/.test(n));
  console.log(`${biome}: ${frames.size} frames (${slopes} slopes, ${mirrors} mirrors) -> ${imageFile} ${image.width}x${image.height}, ${biome}.json`);
  if (unused.length) console.log(`  not used by ${biome}.tiles.json: ${unused.join(', ')}`);
  if (missing.length) throw new Error(`${biome}.tiles.json names frames that do not exist: ${missing.join(', ')}`);
}

const biomes = process.argv.slice(2);
if (biomes.length === 0) throw new Error('usage: npm run tiles:slice -- <biome> [more biomes]');
for (const b of biomes) await slice(b);
