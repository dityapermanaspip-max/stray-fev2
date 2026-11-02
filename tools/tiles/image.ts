import type { Rgba } from './png.ts';

// Small RGBA helpers for the tile tools: blank images, crops, copies and a box-filter resize. No libraries.

export const newImage = (width: number, height: number): Rgba => ({ width, height, data: new Uint8Array(width * height * 4) });

export function crop(img: Rgba, x: number, y: number, w: number, h: number): Rgba {
  const out = newImage(w, h);
  for (let r = 0; r < h; r++) {
    const from = ((y + r) * img.width + x) * 4;
    out.data.set(img.data.subarray(from, from + w * 4), r * w * 4);
  }
  return out;
}

export function blit(dst: Rgba, src: Rgba, x: number, y: number): void {
  for (let r = 0; r < src.height; r++) dst.data.set(src.data.subarray(r * src.width * 4, (r + 1) * src.width * 4), ((y + r) * dst.width + x) * 4);
}

// For each target pixel along an axis of n source pixels resized to m: the source pixels it covers and their weights.
function spans(n: number, m: number): { from: number; weights: number[] }[] {
  const s = n / m;
  return Array.from({ length: m }, (_, d) => {
    const a = d * s, b = Math.min(n, (d + 1) * s), from = Math.floor(a);
    const weights: number[] = [];
    for (let i = from; i < Math.ceil(b); i++) weights.push((Math.min(b, i + 1) - Math.max(a, i)) / (b - a));
    return { from, weights };
  });
}

// Box-filter resize with premultiplied alpha, so transparent edges do not darken. Meant for shrinking.
export function resize(img: Rgba, w: number, h: number): Rgba {
  const src = new Float32Array(img.data.length);
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3] / 255;
    for (let c = 0; c < 3; c++) src[i + c] = img.data[i + c] * a;
    src[i + 3] = img.data[i + 3];
  }
  const across = new Float32Array(w * img.height * 4);
  const xs = spans(img.width, w);
  for (let y = 0; y < img.height; y++) {
    xs.forEach(({ from, weights }, x) => {
      const at = (y * w + x) * 4;
      weights.forEach((wt, k) => {
        const s = (y * img.width + from + k) * 4;
        for (let c = 0; c < 4; c++) across[at + c] += src[s + c] * wt;
      });
    });
  }
  const out = newImage(w, h);
  spans(img.height, h).forEach(({ from, weights }, y) => {
    for (let x = 0; x < w; x++) {
      const px = [0, 0, 0, 0];
      weights.forEach((wt, k) => {
        const s = ((from + k) * w + x) * 4;
        for (let c = 0; c < 4; c++) px[c] += across[s + c] * wt;
      });
      const a = px[3] / 255, at = (y * w + x) * 4;
      out.data[at + 3] = Math.round(px[3]);
      for (let c = 0; c < 3; c++) out.data[at + c] = a > 0 ? Math.min(255, Math.round(px[c] / a)) : 0;
    }
  });
  return out;
}

// Left-right mirror. On an isometric tile this swaps the grid axes: what faced -x now faces -y, +x faces +y.
export function flipX(img: Rgba): Rgba {
  const out = newImage(img.width, img.height);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const from = (y * img.width + x) * 4, to = (y * img.width + img.width - 1 - x) * 4;
      out.data.set(img.data.subarray(from, from + 4), to);
    }
  }
  return out;
}
