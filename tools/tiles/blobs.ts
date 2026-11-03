import { alphaAt, type Rgba } from './png.ts';

// Finds the tiles of a sheet by their alpha: connected opaque areas (4-neighbour), small specks (steam, sparks)
// joined to the tile they float above, then put in reading order: rows by the tile's foot (trees and tall grass
// reach up into the row above, their feet do not), left to right. Also measures each tile's diamond from its outline.

export type Box = { x0: number; y0: number; x1: number; y1: number; area: number }; // inclusive pixel bounds

const SEEN_ALPHA = 16; // softer than this is background
const SOLID_ALPHA = 128; // measuring ignores the soft rim
const SPECK_SHARE = 0.1; // a blob smaller than this share of the biggest one is a speck

export function findBlobs(img: Rgba): Box[] {
  const { width: w, height: h } = img;
  const seen = new Uint8Array(w * h);
  const out: Box[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || alphaAt(img, start % w, Math.floor(start / w)) <= SEEN_ALPHA) continue;
    const box: Box = { x0: w, y0: h, x1: -1, y1: -1, area: 0 };
    seen[start] = 1;
    stack.push(start);
    while (stack.length > 0) {
      const p = stack.pop()!;
      const x = p % w, y = (p - x) / w;
      box.area++;
      box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x);
      box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (!seen[n] && alphaAt(img, nx, ny) > SEEN_ALPHA) { seen[n] = 1; stack.push(n); }
      }
    }
    out.push(box);
  }
  return out;
}

// Specks join the tile whose columns they overlap most, the nearest one by height on ties.
export function joinSpecks(blobs: Box[]): Box[] {
  const biggest = Math.max(...blobs.map((b) => b.area));
  const tiles = blobs.filter((b) => b.area >= biggest * SPECK_SHARE).map((b) => ({ ...b }));
  for (const s of blobs.filter((b) => b.area < biggest * SPECK_SHARE)) {
    const overlap = (t: Box) => Math.min(t.x1, s.x1) - Math.max(t.x0, s.x0);
    const gap = (t: Box) => Math.max(0, t.y0 - s.y1, s.y0 - t.y1);
    const beside = tiles.filter((t) => gap(t) === 0 && overlap(t) > 0); // a puff beside a figure belongs to the figure whose rows it sits in
    const host = (beside.length > 0 ? beside : tiles).reduce((best, t) => (overlap(t) > overlap(best) || (overlap(t) === overlap(best) && gap(t) < gap(best)) ? t : best));
    Object.assign(host, { x0: Math.min(host.x0, s.x0), y0: Math.min(host.y0, s.y0), x1: Math.max(host.x1, s.x1), y1: Math.max(host.y1, s.y1), area: host.area + s.area });
  }
  return tiles;
}

// An object outlined apart from its ground (a gap in the outline) comes out as a second big blob over the same tile:
// boxes that mostly overlap (more than half of the smaller one) are one tile.
export function mergeOverlapping(tiles: Box[]): Box[] {
  const out: Box[] = [];
  const size = (b: Box) => (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1);
  for (const b of [...tiles].sort((p, q) => q.area - p.area)) {
    const host = out.find((t) => {
      const w = Math.min(t.x1, b.x1) - Math.max(t.x0, b.x0) + 1, h = Math.min(t.y1, b.y1) - Math.max(t.y0, b.y0) + 1;
      return w > 0 && h > 0 && w * h > 0.5 * Math.min(size(t), size(b));
    });
    if (!host) { out.push({ ...b }); continue; }
    Object.assign(host, { x0: Math.min(host.x0, b.x0), y0: Math.min(host.y0, b.y0), x1: Math.max(host.x1, b.x1), y1: Math.max(host.y1, b.y1), area: host.area + b.area });
  }
  return out;
}

const opaqueRow =(img: Rgba, b: Box, y: number) => {
  let n = 0;
  for (let x = b.x0; x <= b.x1; x++) if (alphaAt(img, x, y) > SEEN_ALPHA) n++;
  return n;
};

function rebox(img: Rgba, b: Box, y0: number, y1: number): Box {
  const out: Box = { x0: b.x1, y0, x1: b.x0, y1, area: 0 };
  for (let y = y0; y <= y1; y++) {
    for (let x = b.x0; x <= b.x1; x++) {
      if (alphaAt(img, x, y) <= SEEN_ALPHA) continue;
      out.x0 = Math.min(out.x0, x); out.x1 = Math.max(out.x1, x); out.area++;
    }
  }
  return out;
}

// A tile whose bottom tip touches something in the row below (a plant's leaf) comes out as one tall blob. Cut it
// where a narrow row sits under a widening diamond tip (about 4 px wider per row going up). Trees have no such tip.
// narrow: the widest a cut row may be (20 px; a pole or banner stand on the tile below may need more).
export function splitTouching(img: Rgba, tiles: Box[], narrow = 20): Box[] {
  const tall = median(tiles.map((b) => b.y1 - b.y0));
  return tiles.flatMap((b) => {
    if (b.y1 - b.y0 < tall * 1.5) return [b];
    let cut = -1, best = Infinity;
    for (let y = Math.round(b.y0 + tall * 0.6); y <= b.y1 - tall * 0.25; y++) {
      const w = opaqueRow(img, b, y);
      if (w <= narrow && w < best && opaqueRow(img, b, y - 10) - w >= 25 && opaqueRow(img, b, y - 20) - w >= 55) { cut = y; best = w; }
    }
    return cut < 0 ? [b] : [rebox(img, b, b.y0, cut), rebox(img, b, cut + 1, b.y1)];
  });
}

// Reading order: tiles whose feet lie within a third of a tile width share a row; rows top to bottom, left to right.
export function readingOrder(tiles: Box[]): Box[] {
  const widths = tiles.map((b) => b.x1 - b.x0).sort((a, b) => a - b);
  const gap = widths[Math.floor(widths.length / 2)] / 3;
  const rows: Box[][] = [];
  for (const b of [...tiles].sort((p, q) => p.y1 - q.y1)) {
    const row = rows.at(-1);
    if (row && b.y1 - row[0].y1 <= gap) row.push(b);
    else rows.push([b]);
  }
  return rows.flatMap((row) => row.sort((p, q) => p.x0 - q.x0));
}

type Column = { top: number; bottom: number } | null;
function column(img: Rgba, b: Box, x: number): Column {
  let top = -1, bottom = -1;
  for (let y = b.y0; y <= b.y1; y++) {
    if (alphaAt(img, x, y) < SOLID_ALPHA) continue;
    if (top < 0) top = y;
    bottom = y;
  }
  return top < 0 ? null : { top, bottom };
}

export type Measure = {
  width: number; // solid width (the diamond, without the soft rim)
  midX: number; // the diamond's centre column
  foot: number; // lowest solid pixel of the centre column (the bottom corner of the tile's block)
  wall: number; // side wall height at the lower of the left and right corners
};

// Grass tips or an object may stand above the corners, so walls are only trusted as a sheet median (sheetWall).
// Only the box's lower band (the block: walls and the face's corners) is measured, so tall objects and stray specks
// above it do not count.
export function measure(img: Rgba, box: Box): Measure {
  const b = { ...box, y0: Math.max(box.y0, box.y1 - Math.round((box.x1 - box.x0) * 0.6)) };
  let xl = b.x1, xr = b.x0;
  for (let x = b.x0; x <= b.x1; x++) if (column(img, b, x)) { xl = Math.min(xl, x); xr = Math.max(xr, x); }
  const inset = 3;
  const left = column(img, b, xl + inset)!;
  const right = column(img, b, xr - inset)!;
  const midX = Math.round((xl + xr) / 2);
  return { width: xr - xl + 1, midX, foot: column(img, b, midX)!.bottom, wall: Math.min(left.bottom - left.top, right.bottom - right.top) };
}

export const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

// A flat tile's top-face centre: one wall up from its foot, then a quarter of the diamond's width (sheet medians).
export const flatPivot = (m: Measure, wall: number, width: number) => ({ x: m.midX, y: m.foot - wall - width / 4 });
