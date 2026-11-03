import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pack } from './pack.ts';
import { writePng } from './png.ts';
import { makeMirrors, readSheet, TILE_PX, type Source } from './sheet.ts';

// npm run tiles:catalog
// Slices the tile catalog (made by the backend: npm run tiles:export, from the world.tiles table) into three atlases:
// catalog_walk, catalog_block and catalog_obstacle, each with its Phaser json. Every tile row names a sheet and a cell
// (3 x 5, reading order) in public/assets/world/tiles/catalog/sheets; a mirror row is its source flipped left-right.
// Cells no row of the atlas names are skipped. Frames are named by tile key.

const dir = path.resolve(import.meta.dirname, '../../public/assets/world/tiles/catalog');
const ATLASES = ['walk', 'block', 'obstacle'];
const cells = (sheet: string) => Number(sheet.match(/_(6|9|12)$/)?.[1] ?? (sheet.startsWith('big_') ? 9 : 15)); // a trailing _N names the tile count; big_* sheets are 3 x 3

type Row = { key: string; atlas: string; sheet: string | null; cell: number | null; mirrorOf: string | null };

async function slice(atlas: string, rows: Row[]): Promise<void> {
  const frames = new Map<string, Source>();
  const sheets = [...new Set(rows.flatMap((r) => (r.sheet ? [r.sheet] : [])))].sort();
  for (const sheet of sheets) {
    const names: (string | null)[] = Array.from({ length: cells(sheet) }, () => null);
    for (const r of rows) if (r.sheet === sheet) names[r.cell!] = r.key;
    console.log(`  ${await readSheet(path.join(dir, 'sheets'), { file: `${sheet}.png`, names }, frames)}`);
  }
  const mirrors = makeMirrors(Object.fromEntries(rows.filter((r) => r.mirrorOf).map((r) => [r.key, r.mirrorOf!])), frames);
  const { image, json } = pack(frames);
  const imageFile = `catalog_${atlas}_atlas.png`;
  await writeFile(path.join(dir, imageFile), writePng(image));
  const meta = { app: 'stray-fev2 tools/tiles/catalog.ts', image: imageFile, size: { w: image.width, h: image.height }, scale: '1', tileWidth: TILE_PX };
  await writeFile(path.join(dir, `catalog_${atlas}.json`), JSON.stringify({ frames: json, meta }, null, 1) + '\n');
  console.log(`${atlas}: ${frames.size} frames (${mirrors} mirrors) -> ${imageFile} ${image.width}x${image.height}`);
}

const { tiles } = JSON.parse(await readFile(path.join(dir, 'catalog.json'), 'utf8')) as { tiles: Row[] };
for (const atlas of ATLASES) await slice(atlas, tiles.filter((t) => t.atlas === atlas));
