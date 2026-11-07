import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readPng, writePng, type Rgba } from '../../tiles/png.ts';
import { here, run, upload } from '../client.ts';
import { creatureFlow } from './creature_flow.ts';
import { CORRUPTED, FRAMES, NEGATIVE, NO_EYES, SPECIES, STYLE, TRIGGER, VIEW } from './creature_data.ts';

// npm run comfy:creature -- --species chicken|lizard|cat [--corrupted] [--only idle_1,dead] [--size 256] [--seed 7] [--lora creatures_v2] [--strength 1] [--anchor] [--denoise 0.8]
// Draws the 8 battle frames of one creature with the creature LoRA through the ComfyUI API (ComfyUI must be running):
// every frame from text with the same seed (the LoRA is trained at 256 px on sheets, so 256 and "solo" keep it to one animal;
// a frame that comes out as twins: redo it with --only and another --seed). --anchor: frames 2-8 as img2img from idle_1 instead.
// Output: art_out/creatures/<species>[_corrupted]/<frame>.png (transparent), contact.png (on grey, to look at).
// --only redoes just those frames (the rest are read from the last run; idle_1 is read when not redone).

const arg = (name: string, fallback: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at < 0 ? fallback : (process.argv[at + 1] ?? fallback);
};
const has = (name: string) => process.argv.includes(`--${name}`);
const name = arg('species', 'chicken');
const species = SPECIES[name];
if (!species) throw new Error(`unknown --species; known: ${Object.keys(SPECIES).join(', ')}`);
const size = Number(arg('size', '256')), seed = Number(arg('seed', '7')), strength = Number(arg('strength', '1'));
const lora = `${arg('lora', 'creatures_v2')}.safetensors`;
const only = has('only') ? new Set(arg('only', '').split(',')) : null;
const corrupted = has('corrupted');
const fresh = !has('anchor'); // default: every frame from text with the same seed (img2img from idle_1 kept the pose too still)
const denoiseAll = has('denoise') ? Number(arg('denoise', '0.8')) : null; // overrides each frame's own denoise
const dir = here(`../../art_out/creatures/${name}${corrupted ? '_corrupted' : ''}`);
const GREY = 128;

const prompt = (pose: string) =>
  [TRIGGER, species.look, corrupted ? CORRUPTED : '', `(${pose.replace('{attack}', species.attack)}:1.2)`, `(${VIEW}:1.2)`, STYLE, NO_EYES].filter(Boolean).join(', ');

function join(rgb: Rgba, mask: Rgba): Rgba {
  const img: Rgba = { width: rgb.width, height: rgb.height, data: new Uint8Array(rgb.data) };
  for (let i = 0; i < img.data.length; i += 4) img.data[i + 3] = mask.data[i];
  return img;
}

await mkdir(dir, { recursive: true });
const cells: Rgba[] = [];
let anchor: string | undefined; // the uploaded anchor picture (on grey), for img2img
const anchorName = `anchor_${name}${corrupted ? '_c' : ''}.png`;
for (const f of FRAMES) {
  const file = path.join(dir, `${f.key}.png`);
  const raw = path.join(dir, `${f.key}_rgb.png`);
  if (only && !only.has(f.key)) {
    cells.push(readPng(new Uint8Array(await readFile(file))));
    if (f.key === 'idle_1') anchor = await upload(raw, anchorName);
    continue;
  }
  const res = await run(creatureFlow({ prompt: prompt(f.pose), negative: NEGATIVE, seed, lora, strength, size, from: f.key === 'idle_1' || fresh ? undefined : anchor, denoise: denoiseAll ?? f.denoise }));
  await writeFile(raw, res.rgb);
  await writeFile(file, writePng(join(readPng(res.rgb), readPng(res.mask))));
  cells.push(readPng(new Uint8Array(await readFile(file))));
  if (f.key === 'idle_1') anchor = await upload(raw, anchorName);
  console.log(`${f.key} done`);
}

// Contact sheet: 4 x 2 on grey.
const cols = 4, w = cells[0].width, h = cells[0].height;
const sheet: Rgba = { width: w * cols, height: h * 2, data: new Uint8Array(w * cols * h * 2 * 4).fill(GREY) };
cells.forEach((img, n) => {
  const x0 = (n % cols) * w, y0 = Math.floor(n / cols) * h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = ((y0 + y) * sheet.width + x0 + x) * 4, a = img.data[s + 3] / 255;
      for (let k = 0; k < 3; k++) sheet.data[d + k] = Math.round(img.data[s + k] * a + GREY * (1 - a));
      sheet.data[d + 3] = 255;
    }
  }
});
await writeFile(path.join(dir, 'contact.png'), writePng(sheet));
console.log(`contact sheet -> ${dir}`);
