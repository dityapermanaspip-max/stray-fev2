import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { findBlobs, joinSpecks, mergeOverlapping, readingOrder, type Box } from '../tiles/blobs.ts';
import { crop, flipX, resize } from '../tiles/image.ts';
import { pack } from '../tiles/pack.ts';
import { alphaAt, readPng, writePng, type Rgba } from '../tiles/png.ts';
import type { Frame } from '../tiles/skew.ts';

// npm run actors:slice -- <path under public/assets/actors without extension> [more]
// e.g. characters/human/human_suit reads human_suit.actor.json beside the sheets. Sheets are poses on a transparent
// background; `names` gives a frame name per pose in reading order (rows by the feet, left to right; null skips).
// Every pose is scaled by one factor (the median pose height becomes ACTOR_PX) so the figure keeps its size between
// frames. Pivot: the feet, at the centre column of the body's middle band (a held bag or a raised fist does not
// pull it sideways). Writes <name>_atlas.png and <name>.json (Phaser atlas; anims copied into meta.anims).

const ACTOR_PX = 192; // atlas height of a standing pose; the client scales it to the tile size
const PAD = 2;
const root = path.resolve(import.meta.dirname, '../../public/assets/actors');

// mirror: the sheet was drawn facing the other way (a sheet must face down-right when it shows the front, up-left from behind).
type Sheet = { file: string; names: (string | null)[]; mirror?: boolean };
// `sheets` (several, one scale across all) or the older single `sheet` + `names`. shadow: the art has its own shadow.
type Table = { sheets?: Sheet[]; sheet?: string; names?: (string | null)[]; shadow?: boolean; anims?: Record<string, unknown> };

// The centre column of the opaque pixels in the box's middle band (the torso), so a bag or an arm does not count.
function bodyMid(img: Rgba, b: Box): number {
  const y0 = Math.round(b.y0 + (b.y1 - b.y0) * 0.25), y1 = Math.round(b.y0 + (b.y1 - b.y0) * 0.55);
  let sum = 0, n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = b.x0; x <= b.x1; x++) if (alphaAt(img, x, y) > 128) { sum += x; n++; }
  }
  return n ? sum / n : (b.x0 + b.x1) / 2;
}

async function slice(name: string): Promise<void> {
  const base = path.join(root, name);
  const dir = path.dirname(base), stem = path.basename(base);
  const table = JSON.parse(await readFile(`${base}.actor.json`, 'utf8')) as Table;
  const sheets: Sheet[] = table.sheets ?? [{ file: String(table.sheet), names: table.names ?? [] }];
  const read = await Promise.all(sheets.map(async (sh) => {
    const img = readPng(new Uint8Array(await readFile(path.join(dir, sh.file))));
    const poses = readingOrder(mergeOverlapping(joinSpecks(findBlobs(img))));
    if (poses.length !== sh.names.length) throw new Error(`${sh.file}: found ${poses.length} poses, the table names ${sh.names.length}`);
    return { sh, img, poses };
  }));
  const heights = read.flatMap((r) => r.poses.map((b) => b.y1 - b.y0 + 1)).sort((a, b) => a - b);
  const scale = ACTOR_PX / heights[Math.floor(heights.length / 2)];

  const frames = new Map<string, Frame>();
  for (const { sh, img, poses } of read) {
    poses.forEach((b, i) => {
      const frame = sh.names[i];
      if (!frame) return;
      if (frames.has(frame)) throw new Error(`${sh.file}: frame ${frame} named twice`);
      const x = Math.max(0, b.x0 - PAD), y = Math.max(0, b.y0 - PAD);
      const w = Math.min(img.width, b.x1 + PAD + 1) - x, h = Math.min(img.height, b.y1 + PAD + 1) - y;
      const small = resize(crop(img, x, y, w, h), Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)));
      const pivot = { x: (bodyMid(img, b) - x) * scale, y: (b.y1 - y) * scale };
      frames.set(frame, sh.mirror ? { img: flipX(small), pivot: { x: small.width - pivot.x, y: pivot.y } } : { img: small, pivot });
    });
  }

  const missing = Object.entries(table.anims ?? {}).flatMap(([anim, a]) =>
    ((a as { frames?: string[] }).frames ?? []).filter((f) => !frames.has(f)).map((f) => `${anim}:${f}`));
  if (missing.length) throw new Error(`${stem}.actor.json anims name frames that do not exist: ${missing.join(', ')}`);

  const { image, json } = pack(frames);
  const imageFile = `${stem}_atlas.png`;
  await writeFile(path.join(dir, imageFile), writePng(image));
  const meta = { app: 'stray-fev2 tools/actors/slice.ts', image: imageFile, size: { w: image.width, h: image.height }, scale: '1', actorHeight: ACTOR_PX, shadow: !!table.shadow, anims: table.anims ?? {} };
  await writeFile(path.join(dir, `${stem}.json`), JSON.stringify({ frames: json, meta }, null, 1) + '\n');
  console.log(`${name}: ${frames.size} frames from ${sheets.length} sheet(s), pose height ${heights[Math.floor(heights.length / 2)]}px -> ${imageFile} ${image.width}x${image.height}`);
}

const names = process.argv.slice(2);
if (names.length === 0) throw new Error('usage: npm run actors:slice -- <path under public/assets/actors> [more]');
for (const n of names) await slice(n);
