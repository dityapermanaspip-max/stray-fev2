import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { crop } from '../tiles/image.ts';
import { readPng, writePng, type Rgba } from '../tiles/png.ts';
import { here, run, upload } from './client.ts';
import { isWall, writeGuide } from './guides.ts';
import { SETS } from './sets.ts';
import { control, footprint, type Footprint } from './template.ts';
import { tileFlow } from './workflow.ts';

// npm run comfy:tiles -- --set meadow|desert|grove|conn_meadow_grove|conn_meadow_desert|conn_grove_desert [--only key,key] [--size 256] [--lora tiles_walkable_v1] [--strength 0.8] [--rows 5,6,7] [--denoise 0.45]
// Generates a 64-tile test set (sets.ts) with the tile LoRA through the ComfyUI API (ComfyUI must be running), cuts
// each tile out (Inspyrenet), and packs the 8 x 8 atlas. Output: art_out/meadow_test/<row>/<NN>_<key>.png (one per
// tile, transparent), atlas.png (8 x 8 cells of --size), atlas.json (key -> cell), contact.png (on grey, to look at).
// Rows share a seed so a family looks alike. --only (keys) or --rows (1-based) redo just those; the rest are read from
// the files of the last run. A tile with a layout guide (guides.ts: edges, corners, paths) starts from it at --denoise.

const arg = (name: string, fallback: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at < 0 ? fallback : (process.argv[at + 1] ?? fallback);
};
const has = (name: string) => process.argv.includes(`--${name}`);
const size = Number(arg('size', '256')), lora = `${arg('lora', 'tiles_walkable_v1')}.safetensors`, strength = Number(arg('strength', '0.8'));
const only = has('only') ? new Set(arg('only', '').split(',')) : null;
const rows = has('rows') ? new Set(arg('rows', '').split(',').map(Number)) : null;
const denoise = Number(arg('denoise', '0.45'));
const set = SETS[arg('set', 'meadow')];
if (!set) throw new Error(`unknown --set; known: ${Object.keys(SETS).join(', ')}`);
const { rows: ROWS } = set;
const out = here(`../../art_out/${set.name}_test`);
const STYLE = 'isometric game tile, walkable ground tile, {what}, {biome} biome{side}, hand-painted 2D fantasy game art, clean dark brown outlines, soft shading, lit evenly from directly above, soft neutral light, no cast shadow, flat grey background';
const NEGATIVE = 'tree roots, roots, text, watermark, people, animals, trees, buildings, tall objects, perspective, blurry, dark shadow, directional light, multiple tiles, frame, border';
const GREY = 128;

// A set's wall reference: a picture file (a single tile, or a cell of an 8-column atlas) read from the repo root.
async function wallFrom(ref: { file: string; cell?: number }): Promise<Rgba> {
  const img = readPng(new Uint8Array(await readFile(here('../..', ref.file))));
  if (ref.cell === undefined) return img;
  return crop(img, (ref.cell % 8) * size, Math.floor(ref.cell / 8) * size, size, size);
}

// A guided tile takes its side wall from the first tile of the set (the wall the plain tiles share), so the walls match.
function withWall(img: Rgba, wall: Rgba, fp: Footprint): Rgba {
  const out: Rgba = { width: img.width, height: img.height, data: new Uint8Array(img.data) };
  for (let y = 0; y < fp.h; y++) {
    for (let x = 0; x < fp.w; x++) {
      const at = (y * fp.w + x) * 4;
      if (isWall(fp, x, y)) out.data.set(wall.data.subarray(at, at + 4), at);
    }
  }
  return out;
}

// The tile as RGBA. Cut-out: the mask node saves white = tile; a guided tile is cut by the known footprint instead
// (exact diamond and wall, no faded edges), when the picture is the footprint size.
function join(rgb: Rgba, mask: Rgba, footprint?: Uint8Array): Rgba {
  const img: Rgba = { width: rgb.width, height: rgb.height, data: new Uint8Array(rgb.data) };
  for (let i = 0; i < img.data.length; i += 4) img.data[i + 3] = footprint ? footprint[i / 4] * 255 : mask.data[i];
  return img;
}

const ctl = await upload(await control(here('../../art_out')), 'meadow_control.png');
const fp = await footprint();
const blank = (): Rgba => ({ width: size, height: size, data: new Uint8Array(size * size * 4) });
const cells: { key: string; img: Rgba }[] = [];
const cols = Math.max(...ROWS.map((r) => r.tiles.length)), total = ROWS.reduce((n, r) => n + r.tiles.length, 0);
const wallOf = set.wallRef ? await wallFrom(set.wallRef) : null; // else the set's first tile
for (const [r, row] of ROWS.entries()) {
  await mkdir(path.join(out, row.name), { recursive: true });
  for (const [c, [key, what]] of row.tiles.entries()) {
    const n = r * cols + c;
    const file = path.join(out, row.name, `${String(n + 1).padStart(2, '0')}_${key}.png`);
    if ((only && !only.has(key)) || (rows && !rows.has(r + 1))) { cells.push({ key, img: await readFile(file).then((b) => readPng(new Uint8Array(b)), blank) }); continue; }
    const guide = await writeGuide(path.join(out, 'guides', row.name), key, fp, set.palette);
    const res = await run(tileFlow({ prompt: STYLE.replace('{what}', what).replace('{biome}', set.biome).replace('{side}', set.side ? `, ${set.side}` : ''), negative: NEGATIVE, seed: 1000 + r * 37 + (set.name === 'meadow' ? 0 : 500), lora, control: ctl, size, strength, guide: guide ? await upload(guide, `guide_${key}.png`) : undefined, denoise }));
    let img = join(readPng(res.rgb), readPng(res.mask), guide && fp.w === size ? fp.inside : undefined);
    const wall = wallOf ?? cells[0]?.img;
    if (guide && fp.w === size && wall) img = withWall(img, wall, fp);
    await writeFile(file, writePng(img));
    cells.push({ key, img });
    console.log(`${n + 1}/${total} ${key}`);
  }
}
const atlas = blank(), contact = blank();
atlas.width = contact.width = size * cols;
atlas.height = contact.height = size * ROWS.length;
atlas.data = new Uint8Array(atlas.width * atlas.height * 4);
contact.data = new Uint8Array(atlas.width * atlas.height * 4).fill(GREY);
cells.forEach(({ img }, n) => {
  const x0 = (n % cols) * size, y0 = Math.floor(n / cols) * size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4, d = ((y0 + y) * atlas.width + x0 + x) * 4, a = img.data[s + 3] / 255;
      atlas.data.set(img.data.subarray(s, s + 4), d);
      for (let k = 0; k < 3; k++) contact.data[d + k] = Math.round(img.data[s + k] * a + GREY * (1 - a));
      contact.data[d + 3] = 255;
    }
  }
});
await writeFile(path.join(out, 'atlas.png'), writePng(atlas));
await writeFile(path.join(out, 'contact.png'), writePng(contact));
await writeFile(path.join(out, 'atlas.json'), JSON.stringify({ size, columns: cols, tiles: cells.map((c, n) => ({ key: c.key, cell: n })) }, null, 1) + '\n');
console.log(`atlas ${atlas.width}x${atlas.height} -> ${out}`);
