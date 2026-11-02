import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { findBlobs, joinSpecks, median, mergeOverlapping, readingOrder } from '../tiles/blobs.ts';
import { crop, resize } from '../tiles/image.ts';
import { pack } from '../tiles/pack.ts';
import { readPng, writePng } from '../tiles/png.ts';
import type { Frame } from '../tiles/skew.ts';

// npm run buildings:slice -- <style> [more styles]
// Reads public/assets/world/town/buildings/buildings.json: each style's sheets are 3 x 5 buildings standing on their
// own ground patch, one per cell. Frames are <style>_NN (cell number in reading order, rows by the feet), `skip` drops
// cells that are not buildings. One scale per sheet: the median patch width becomes UNIT_PX, so small buildings stay
// small. Pivot: the patch's middle (a quarter of its width above its bottom tip). The client scales UNIT_PX to the
// footprint's width on screen.

const UNIT_PX = 320;
const PAD = 2;
const CELLS = 15;
const root = path.resolve(import.meta.dirname, '../../public/assets/world/town/buildings');

type Style = { sheets: string[]; skip?: number[] };
type Table = { styles: Record<string, Style> };

async function slice(name: string, style: Style): Promise<void> {
  const dir = path.join(root, name);
  const frames = new Map<string, Frame>();
  let cell = 0;
  for (const file of style.sheets) {
    const img = readPng(new Uint8Array(await readFile(path.join(dir, file))));
    const boxes = readingOrder(mergeOverlapping(joinSpecks(findBlobs(img))));
    if (boxes.length !== CELLS) throw new Error(`${name}/${file}: found ${boxes.length} buildings, want ${CELLS} (3 x 5)`);
    const scale = UNIT_PX / median(boxes.map((b) => b.x1 - b.x0 + 1));
    for (const b of boxes) {
      cell++;
      if (style.skip?.includes(cell)) continue;
      const x = Math.max(0, b.x0 - PAD), y = Math.max(0, b.y0 - PAD);
      const w = Math.min(img.width, b.x1 + PAD + 1) - x, h = Math.min(img.height, b.y1 + PAD + 1) - y;
      const small = resize(crop(img, x, y, w, h), Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)));
      const pivot = { x: ((b.x0 + b.x1) / 2 - x) * scale, y: (b.y1 - (b.x1 - b.x0 + 1) / 4 - y) * scale };
      frames.set(`${name}_${String(cell).padStart(2, '0')}`, { img: small, pivot });
    }
  }
  const { image, json } = pack(frames);
  const imageFile = `${name}_atlas.png`;
  await writeFile(path.join(dir, imageFile), writePng(image));
  const meta = { app: 'stray-fev2 tools/buildings/slice.ts', image: imageFile, size: { w: image.width, h: image.height }, scale: '1', unitWidth: UNIT_PX };
  await writeFile(path.join(dir, `${name}.json`), JSON.stringify({ frames: json, meta }, null, 1) + '\n');
  console.log(`${name}: ${frames.size} buildings -> ${imageFile} ${image.width}x${image.height}`);
}

const table = JSON.parse(await readFile(path.join(root, 'buildings.json'), 'utf8')) as Table;
const names = process.argv.slice(2);
if (names.length === 0) throw new Error(`usage: npm run buildings:slice -- <style> [more]; styles: ${Object.keys(table.styles).join(', ')}`);
for (const n of names) {
  const style = table.styles[n];
  if (!style) throw new Error(`buildings.json has no style ${n}`);
  await slice(n, style);
}
