import { newImage } from './image.ts';
import type { Rgba } from './png.ts';

// Makes a one-level slope frame from a flat tile frame, matching the server's slopes: the top face tilts so the edge
// facing `dir` (0 +x, 1 +y, 2 -x, 3 -y, the server's uphill directions) rises half a level and the opposite edge sinks
// half a level around the face's centre (the client draws a slope at h + 0.5). Each pixel column only moves up or
// down (a shear), so the art keeps its look. The side walls stretch from the tilted face down to the tile's foot,
// which stays where a flat tile at the low height has it. `light` brightens or darkens the face only.

export type Frame = { img: Rgba; pivot: { x: number; y: number } }; // pivot: top-face centre in frame pixels

const STEPS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// Linear sample down column x at fractional row y, alpha-weighted, written to out at byte offset `at`.
function sample(img: Rgba, x: number, y: number, light: number, out: Uint8Array, at: number): void {
  if (y < 0 || y > img.height - 1) return;
  const y0 = Math.floor(y), y1 = Math.min(img.height - 1, y0 + 1), t = y - y0;
  const i0 = (y0 * img.width + x) * 4, i1 = (y1 * img.width + x) * 4;
  const a0 = img.data[i0 + 3] * (1 - t), a1 = img.data[i1 + 3] * t;
  const a = a0 + a1;
  out[at + 3] = Math.round(a);
  if (a <= 0) return;
  for (let c = 0; c < 3; c++) out[at + c] = Math.min(255, Math.round(((img.data[i0 + c] * a0 + img.data[i1 + c] * a1) / a) * light));
}

// width: the diamond's width in frame pixels; wall: the side wall's height; level: pixels per height level.
export function slopeFrom(src: Frame, width: number, wall: number, level: number, dir: number, light: number): Frame {
  const [ux, uy] = STEPS[dir];
  const a = ((ux - uy) / width) * level, b = ((2 * (ux + uy)) / width) * level; // lift in px = a * sx + b * sy
  const pad = Math.ceil(level / 2) + 2;
  const out = newImage(src.img.width, src.img.height + 2 * pad);
  const { x: px, y: py } = src.pivot;
  for (let x = 0; x < out.width; x++) {
    const sx = x + 0.5 - px;
    const half = Math.max(0, (width / 4) * (1 - Math.abs(sx) / (width / 2)));
    const top = py - half, bot = py + half;
    const liftTop = a * sx + b * (top - py), liftBot = a * sx + b * (bot - py);
    const faceEnd = bot - liftBot; // where the tilted face's lower edge lands
    const foot = bot + wall + level / 2; // the low tile's foot, kept
    for (let y = 0; y < out.height; y++) {
      const yd = y - pad + 0.5;
      let sy: number;
      let lit = light;
      if (yd < top - liftTop) sy = yd + liftTop; // above the face: grass tips, outline
      else if (yd <= faceEnd) sy = (yd + a * sx - b * py) / (1 - b); // the face
      else if (yd <= foot) { sy = bot + ((yd - faceEnd) / Math.max(1, foot - faceEnd)) * wall; lit = 1; } // the wall
      else { sy = yd - level / 2; lit = 1; } // under the foot: outline
      sample(src.img, x, sy - 0.5, lit, out.data, (y * out.width + x) * 4);
    }
  }
  return { img: out, pivot: { x: px, y: py + pad } };
}
