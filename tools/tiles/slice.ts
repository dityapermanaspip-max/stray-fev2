import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LIFT, TILE_W } from '../../src/field/iso.ts';
import { pack } from './pack.ts';
import { writePng } from './png.ts';
import { makeMirrors, readSheet, TILE_PX, type Sheet, type Source } from './sheet.ts';
import { slopeFrom } from './skew.ts';

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

const LEVEL_PX = (TILE_PX * LIFT) / TILE_W; // one height level in atlas pixels
const SIDES = ['dr', 'dl', 'ul', 'ur'];
const LIGHT = [0.88, 0.88, 1.1, 1.1]; // the face's light by uphill direction, as the plain-colour ground does
const root = path.resolve(import.meta.dirname, '../../public/assets/world/tiles');

type Slopes = Record<string, string[] | { x: string[]; y: string[] }>;
type Table = { sheets: Sheet[]; slopes?: Slopes; mirror?: Record<string, string>; [key: string]: unknown };

const num = (n: number) => String(n).padStart(2, '0');

// Every string in the use table that looks like a frame name of this biome.
function namedFrames(biome: string, table: unknown): string[] {
  if (typeof table === 'string') return table.startsWith(`${biome}_`) ? [table] : [];
  if (Array.isArray(table)) return table.flatMap((v) => namedFrames(biome, v));
  if (table && typeof table === 'object') return Object.values(table).flatMap((v) => namedFrames(biome, v));
  return [];
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
