import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { findBlobs, joinSpecks, mergeOverlapping, readingOrder, splitTouching } from '../tiles/blobs.ts';
import { crop } from '../tiles/image.ts';
import { readPng, writePng, type Rgba } from '../tiles/png.ts';

// npm run lora:tiles [-- <kohya dataset root>]
// Makes the training sets for the two tile LoRAs from the ORIGINAL sheets (not the scaled atlases): one image per
// tile on a flat grey background, padded to a square and scaled to SIZE (256), with a caption .txt made from the tile's
// description, terrain and biome (captions.json, written by the backend's tiles:export). Mirrors are skipped (same
// picture). Every HOLD_EVERY-th tile goes to <set>/holdout to test the LoRA on tiles it has not seen.
//   tiles_walkable: atlas walk      tiles_obstacle: atlas obstacle + block
// Layout (what kohya wants): <root>/<set>/img/<repeats>_<set>/<key>.png + .txt

const dir = path.resolve(import.meta.dirname, '../../public/assets/world/tiles/catalog');
const root = process.argv[2] ?? 'C:/kohya/dataset';
const SIZE = 256, MARGIN = 8, GREY = 128, HOLD_EVERY = 10, PAD = 2;
const SETS: Record<string, { atlases: string[]; repeats: number }> = {
  tiles_walkable: { atlases: ['walk'], repeats: 10 },
  tiles_obstacle: { atlases: ['obstacle', 'block'], repeats: 5 },
};
const STYLE = 'isometric game tile, hand-painted 2D fantasy game art, clean dark brown outlines, soft shading, flat grey background';

type Row = { key: string; atlas: string; terrain: string; biome: string; sheet: string | null; cell: number | null; mirrorOf: string | null; nodeKind: string | null };
const count = (sheet: string) => Number(sheet.match(/_(6|9|12)$/)?.[1] ?? (sheet.startsWith('big_') ? 9 : 15));

// The tile on a flat grey square, scaled (bilinear) so its longer side fills SIZE minus a margin.
function square(tile: Rgba): Rgba {
  const out: Rgba = { width: SIZE, height: SIZE, data: new Uint8Array(SIZE * SIZE * 4).fill(255) };
  for (let i = 0; i < SIZE * SIZE; i++) out.data.fill(GREY, i * 4, i * 4 + 3);
  const k = (SIZE - 2 * MARGIN) / Math.max(tile.width, tile.height);
  const w = Math.round(tile.width * k), h = Math.round(tile.height * k);
  const ox = Math.floor((SIZE - w) / 2), oy = Math.floor((SIZE - h) / 2);
  const px = (x: number, y: number, c: number) => { // premultiplied, so transparent edges do not darken
    const i = (Math.min(tile.height - 1, y) * tile.width + Math.min(tile.width - 1, x)) * 4;
    return c === 3 ? tile.data[i + 3] : (tile.data[i + c] * tile.data[i + 3]) / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.max(0, (x + 0.5) / k - 0.5), sy = Math.max(0, (y + 0.5) / k - 0.5);
      const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
      const at = ((oy + y) * SIZE + ox + x) * 4;
      const lerp = (c: number) => (px(x0, y0, c) * (1 - fx) + px(x0 + 1, y0, c) * fx) * (1 - fy) + (px(x0, y0 + 1, c) * (1 - fx) + px(x0 + 1, y0 + 1, c) * fx) * fy;
      const a = lerp(3) / 255;
      for (let c = 0; c < 3; c++) out.data[at + c] = Math.round(lerp(c) + GREY * (1 - a));
    }
  }
  return out;
}

function caption(r: Row, text: string): string {
  const what = r.atlas === 'walk' ? 'walkable ground tile' : r.atlas === 'block' ? 'solid block tile' : 'obstacle tile';
  const node = r.nodeKind ? `, ${r.nodeKind} resource node` : '';
  return [STYLE.split(',')[0], what, text, `${r.terrain} terrain`, ...(r.biome === 'any' ? [] : [`${r.biome} biome`]), ...(node ? [node.slice(2)] : []), ...STYLE.split(',').slice(1).map((s) => s.trim())].join(', ');
}

const { tiles } = JSON.parse(await readFile(path.join(dir, 'catalog.json'), 'utf8')) as { tiles: Row[] };
const captions = JSON.parse(await readFile(path.join(dir, 'captions.json'), 'utf8')) as Record<string, string>;
const sheetCache = new Map<string, Rgba[][]>(); // sheet -> [cell] -> raw tile image (cropped), in reading order
async function cut(sheet: string): Promise<Rgba[]> {
  const img = readPng(new Uint8Array(await readFile(path.join(dir, 'sheets', `${sheet}.png`))));
  const joined = mergeOverlapping(joinSpecks(findBlobs(img)));
  let boxes = readingOrder(splitTouching(img, joined));
  if (boxes.length < count(sheet)) boxes = readingOrder(splitTouching(img, joined, 45));
  if (boxes.length !== count(sheet)) throw new Error(`${sheet}: found ${boxes.length} tiles, expected ${count(sheet)}`);
  return boxes.map((b) => {
    const x = Math.max(0, b.x0 - PAD), y = Math.max(0, b.y0 - PAD);
    return crop(img, x, y, Math.min(img.width, b.x1 + PAD + 1) - x, Math.min(img.height, b.y1 + PAD + 1) - y);
  });
}

for (const [set, { atlases, repeats }] of Object.entries(SETS)) {
  const train = path.join(root, set, 'img', `${repeats}_${set}`), hold = path.join(root, set, 'holdout');
  await rm(path.join(root, set), { recursive: true, force: true });
  await mkdir(train, { recursive: true });
  await mkdir(hold, { recursive: true });
  const rows = tiles.filter((t) => atlases.includes(t.atlas) && t.sheet && t.cell !== null && !t.mirrorOf);
  let n = 0, held = 0;
  for (const r of rows) {
    if (!sheetCache.has(r.sheet!)) sheetCache.set(r.sheet!, [await cut(r.sheet!)]);
    const tile = sheetCache.get(r.sheet!)![0][r.cell!];
    const out = n++ % HOLD_EVERY === HOLD_EVERY - 1 ? (held++, hold) : train;
    await writeFile(path.join(out, `${r.key}.png`), writePng(square(tile)));
    await writeFile(path.join(out, `${r.key}.txt`), caption(r, captions[r.key] || r.key.replace(/_/g, ' ')) + '\n');
  }
  console.log(`${set}: ${n - held} train + ${held} holdout -> ${path.join(root, set)}`);
}
