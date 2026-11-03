import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readPng, writePng, type Rgba } from '../tiles/png.ts';

// The tile footprint, taken from a training picture of grass_lush (silhouette against its flat grey background).
// Used for the ControlNet outline (so every generated tile keeps the same diamond and wall) and for the layout guides.
const SOURCE = 'C:/kohya/dataset/tiles_walkable/img/10_tiles_walkable/grass_lush.png';
const FLAT_GREY = 128, FAR = 36; // a pixel this far from the grey background (summed over r, g, b) is the tile

export type Footprint = { w: number; h: number; inside: Uint8Array; cx: number; cy: number; half: number }; // half: half the diamond width

export async function footprint(): Promise<Footprint> {
  const img = readPng(new Uint8Array(await readFile(SOURCE)));
  const { width: w, height: h } = img;
  const inside = new Uint8Array(w * h);
  let x0 = w, x1 = 0, y0 = h;
  for (let i = 0; i < w * h; i++) {
    const d = Math.abs(img.data[i * 4] - FLAT_GREY) + Math.abs(img.data[i * 4 + 1] - FLAT_GREY) + Math.abs(img.data[i * 4 + 2] - FLAT_GREY);
    if (d <= FAR) continue;
    inside[i] = 1;
    x0 = Math.min(x0, i % w); x1 = Math.max(x1, i % w); y0 = Math.min(y0, Math.floor(i / w));
  }
  const half = (x1 - x0 + 1) / 2;
  return { w, h, inside, cx: (x0 + x1) / 2, cy: y0 + half / 2, half }; // the top vertex is y0, the diamond is half wide and half / 2 tall
}

// White outline on black, the ControlNet input.
export async function control(dir: string): Promise<string> {
  const { w, h, inside } = await footprint();
  const out: Rgba = { width: w, height: h, data: new Uint8Array(w * h * 4) };
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const edge = inside[i] !== inside[i + 1] || inside[i] !== inside[i + w];
      out.data.set(edge ? [255, 255, 255, 255] : [0, 0, 0, 255], i * 4);
    }
  }
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, 'meadow_control.png');
  await writeFile(file, writePng(out));
  return file;
}
