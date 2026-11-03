import type { FieldView } from '../../../stray-bev1/shared/field.ts';
import { sideWhere } from './tile_rules.ts';

// Which catalog drawing a tile gets (pure, no Phaser). The catalog is the world.tiles table, made into a file by the
// backend (npm run tiles:export). A tile finds the rows of its terrain, prefers the rows of its own biome, and takes
// an edge piece when a neighbour terrain lies on the side the piece is for; else a plain row, picked by position
// and weight (same tile, same drawing, every time).

export type CatalogRow = {
  key: string; atlas: 'walk' | 'block' | 'obstacle'; terrain: string; biome: string;
  edge: string | null; edgeOf: string | null; weight: number; nodeKind: string | null;
};
export type Catalog = Map<string, CatalogRow[]>; // by terrain

export const byTerrain = (rows: CatalogRow[]): Catalog => {
  const out: Catalog = new Map();
  for (const r of rows) out.set(r.terrain, [...(out.get(r.terrain) ?? []), r]);
  return out;
};

function weighted(rows: CatalogRow[], x: number, y: number): CatalogRow | null {
  if (rows.length === 0) return null;
  let h = Math.imul(x + 1, 0x27d4eb2d) ^ Math.imul(y + 1, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  let roll = ((h ^ (h >>> 13)) >>> 0) % rows.reduce((s, r) => s + r.weight, 0);
  return rows.find((r) => (roll -= r.weight) < 0) ?? rows[0];
}

export function pickRow(cat: Catalog, view: FieldView, i: number): CatalogRow | null {
  const tile = view.tiles[i];
  const x = i % view.width, y = Math.floor(i / view.width);
  const all = cat.get(tile.t);
  if (!all) return null;
  const own = all.filter((r) => r.biome === tile.b);
  const rows = own.length > 0 ? own : all;
  const edged = rows.filter((r) => r.edge && sideWhere(view, x, y, (t) => t === r.edgeOf) === r.edge);
  return weighted(edged.length > 0 ? edged : rows.filter((r) => !r.edge), x, y);
}

// The big obstacle that stands for a resource node: a row whose node_kind is the node's kind, from the field's own
// biome, else one made for any biome (cave mouth, camp). Several rows: picked by position and weight.
export function pickNode(cat: Catalog, biome: string, kind: string, x: number, y: number): CatalogRow | null {
  const all = [...cat.values()].flat().filter((r) => r.nodeKind === kind);
  const own = all.filter((r) => r.biome === biome);
  return weighted(own.length > 0 ? own : all.filter((r) => r.biome === 'any'), x, y);
}
