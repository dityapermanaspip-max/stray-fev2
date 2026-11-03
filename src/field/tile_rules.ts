import type { FieldView } from '../../../stray-bev1/shared/field.ts';

// Which sheet frame a field tile uses, from the biome's use table (public/assets/world/tiles/<biome>/<biome>.tiles.json).
// Pure: no Phaser. A tile without a frame keeps the plain-colour ground (ground.ts). Looks only, never gameplay.

// Sides of a tile in grid terms, named by where they face on screen: ul = -x, ur = -y, lr = +x, ll = +y; the corners
// top, right, bottom, left are two neighbouring sides (top = -x and -y).
export type Side = 'ul' | 'ur' | 'lr' | 'll' | 'top' | 'right' | 'bottom' | 'left';
type Sided = Partial<Record<Side, string[]>>;
// shore: water-like tiles bordering other terrain pick a piece by where that terrain is (one side or a corner).
type Pick = string[] | { edge: string[]; inner: string[]; shore?: Sided };
export type UseTable = {
  filler: string; // block stacked under raised tiles
  blockLevels: number; // height levels one block covers
  terrain: Record<string, Pick>;
  marker: string[]; // obstacles drawn as markerGround with the placeholder mark on top
  markerGround: string;
  slope: Record<string, string>; // terrain -> frame group; 'default' for the rest
  node: Record<string, string[]>; // resource node kind -> frames with the node standing on its ground
  bank: Record<string, Sided>; // water terrain -> pieces for a land tile beside it, by the side the water is on
};

export type TileLook = { frame: string; marker: boolean; node: boolean }; // node: the frame shows the node

// Uphill direction (server slope 0-3: +x, +y, -x, -y) -> the slope frames' side (the slicer makes all four).
const SLOPE_SIDE = ['dr', 'dl', 'ul', 'ur'];
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SIDE_OF: Record<string, Side> = { '-1,0': 'ul', '0,-1': 'ur', '1,0': 'lr', '0,1': 'll' };
const STRAIGHT: Side[] = ['ul', 'ur', 'lr', 'll'];
const CORNER: Record<string, Side> ={ 'ul,ur': 'top', 'lr,ur': 'right', 'll,lr': 'bottom', 'll,ul': 'left' };

export function parseUseTable(raw: Record<string, unknown>): UseTable {
  return {
    filler: String(raw.filler),
    blockLevels: Number(raw.block_levels ?? 2),
    terrain: (raw.terrain as Record<string, Pick>) ?? {},
    marker: Array.isArray(raw.marker) ? raw.marker.map(String) : [],
    markerGround: String(raw.marker_ground ?? ''),
    slope: (raw.slope as Record<string, string>) ?? {},
    node: (raw.node as Record<string, string[]>) ?? {},
    bank: (raw.bank as Record<string, Sided>) ?? {},
  };
}

// Same tile, same variant, every time (a small integer hash of the position).
function variant<T>(list: readonly T[], x: number, y: number): T | null {
  if (list.length === 0) return null;
  let h = Math.imul(x + 1, 0x27d4eb2d) ^ Math.imul(y + 1, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return list[((h ^ (h >>> 13)) >>> 0) % list.length];
}

// Water-like terrains: inner when all four neighbours are the same terrain (the field edge counts as different).
function inner(view: FieldView, x: number, y: number, terrain: string): boolean {
  return NEIGHBOURS.every(([dx, dy]) => {
    const nx = x + dx, ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < view.width && ny < view.height && view.tiles[ny * view.width + nx].t === terrain;
  });
}

// Sides of tile (x, y) whose neighbour passes `test` (the field edge never does), as one side, a corner, or null.
export function sideWhere(view: FieldView, x: number, y: number, test: (t: string) => boolean): Side | null {
  const sides: Side[] = [];
  for (const [dx, dy] of NEIGHBOURS) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= view.width || ny >= view.height) continue;
    if (test(view.tiles[ny * view.width + nx].t)) sides.push(SIDE_OF[`${dx},${dy}`]);
  }
  if (sides.length === 1) return sides[0];
  return sides.length === 2 ? (CORNER[sides.sort().join(',')] ?? null) : null;
}

const pickFrom = (list: string[] | undefined, frames: readonly string[], x: number, y: number) =>
  variant((list ?? []).filter((f) => frames.includes(f)), x, y);

// A shore piece for a water-like tile, or a bank piece for a land tile beside water; null when neither fits.
function edgePiece(table: UseTable, frames: readonly string[], view: FieldView, x: number, y: number, terrain: string, pick: Pick | undefined) {
  if (pick && !Array.isArray(pick) && pick.shore) {
    const side = sideWhere(view, x, y, (t) => t !== terrain);
    if (side) return pickFrom(pick.shore[side], frames, x, y);
  }
  for (const [water, pieces] of Object.entries(table.bank)) {
    const side = sideWhere(view, x, y, (t) => t === water);
    if (side && STRAIGHT.includes(side)) return pickFrom(pieces[side], frames, x, y); // banks face one side only
  }
  return null;
}

// The frame for tile i, or null for plain colour. `frames` are the atlas frame names of the tile's biome; `node` is
// the resource node standing on the tile, if any (a flat tile then shows the node's own frame when the table has one).
export function tileLook(
  table: UseTable, frames: readonly string[], biome: string, view: FieldView, i: number, node: string | null = null,
): TileLook | null {
  const tile = view.tiles[i];
  const x = i % view.width, y = Math.floor(i / view.width);
  if (node && tile.s < 0) {
    const frame = variant((table.node[node] ?? []).filter((f) => frames.includes(f)), x, y);
    if (frame) return { frame, marker: false, node: true };
  }
  if (tile.s >= 0) {
    const side = SLOPE_SIDE[tile.s];
    if (!side) return null;
    const group = table.slope[tile.t] ?? table.slope.default;
    const prefix = `${biome}_${group}_${side}_`;
    const frame = group ? variant(frames.filter((f) => f.startsWith(prefix)), x, y) : null;
    return frame ? { frame, marker: false, node: false } : null;
  }
  const marker = table.marker.includes(tile.t);
  const terrain = marker ? table.markerGround : tile.t;
  const pick = table.terrain[terrain];
  const edge = marker ? null : edgePiece(table, frames, view, x, y, terrain, pick);
  if (edge) return { frame: edge, marker: false, node: false };
  if (!pick) return null;
  const list = Array.isArray(pick) ? pick : inner(view, x, y, tile.t) ? pick.inner : pick.edge;
  const frame = variant(list.filter((f) => frames.includes(f)), x, y);
  return frame ? { frame, marker, node: false } : null;
}

// Heights of the filler blocks under a tile at height h: one block below the other until the ground floor.
export function fillerLevels(h: number, blockLevels: number): number[] {
  const out: number[] = [];
  for (let k = h - blockLevels; k > 0; k -= blockLevels) out.push(k);
  if (h > 0) out.push(0);
  return out;
}
