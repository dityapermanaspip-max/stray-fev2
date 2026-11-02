import { blit, newImage } from './image.ts';
import type { Rgba } from './png.ts';
import type { Frame } from './skew.ts';

// Packs frames into one atlas image on shelves (tallest first) and makes the Phaser JSON-hash frames with pivots.

const MAX_WIDTH = 2048, PAD = 2;

export function pack(frames: Map<string, Frame>): { image: Rgba; json: Record<string, unknown> } {
  const order = [...frames.entries()].sort((a, b) => b[1].img.height - a[1].img.height || a[0].localeCompare(b[0]));
  const spots = new Map<string, { x: number; y: number }>();
  let x = PAD, y = PAD, shelf = 0, width = 0;
  for (const [name, f] of order) {
    if (x + f.img.width + PAD > MAX_WIDTH) { x = PAD; y += shelf + PAD; shelf = 0; }
    spots.set(name, { x, y });
    x += f.img.width + PAD;
    shelf = Math.max(shelf, f.img.height);
    width = Math.max(width, x);
  }
  const image = newImage(width, y + shelf + PAD);
  const json: Record<string, unknown> = {};
  for (const [name, f] of [...frames.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const at = spots.get(name)!;
    blit(image, f.img, at.x, at.y);
    const w = f.img.width, h = f.img.height;
    json[name] = {
      frame: { x: at.x, y: at.y, w, h }, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w, h }, sourceSize: { w, h },
      pivot: { x: +(f.pivot.x / w).toFixed(4), y: +(f.pivot.y / h).toFixed(4) },
    };
  }
  return { image, json };
}
