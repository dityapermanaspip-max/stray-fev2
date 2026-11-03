import { ROWS as DESERT } from './desert_tiles.ts';
import { ROWS as GROVE } from './grove_tiles.ts';
import { ROWS as MEADOW } from './meadow_tiles.ts';
import { connectRows } from './conn_tiles.ts';
import type { Palette } from './guides.ts';

// The tile sets the generator knows: its rows (8 tiles each, 8 rows), the biome word and the side wording for the
// prompt, and the guide palette (colours of the ground and of what is laid on it, by key prefix; see guides.ts).
export type TileSet = {
  name: string; biome: string; side: string; rows: { name: string; tiles: [string, string][] }[]; palette: Palette;
  wallRef?: { file: string; cell?: number }; // the side wall for guided tiles (default: the set's first tile)
};

const MEADOW_WALL = { file: 'art_out/meadow_test/grass/01_grass_a.png' };
const GRASS: [number, number, number] = [96, 150, 50];

export const SETS: Record<string, TileSet> = {
  meadow: {
    name: 'meadow', biome: 'meadow', side: '', rows: MEADOW,
    palette: { wall: [112, 78, 48], edges: ['gd'], layers: { gd: [GRASS, [204, 154, 92]], dp: [GRASS, [204, 154, 92]], cp: [GRASS, [168, 164, 150]] } },
  },
  desert: {
    name: 'desert', biome: 'desert', side: 'layered sandstone on the sides', rows: DESERT,
    palette: { wall: [190, 142, 92], edges: ['se'], layers: { se: [[226, 196, 140], [176, 112, 76]], tp: [[226, 196, 140], [150, 112, 76]], fp: [[226, 196, 140], [176, 168, 154]] } },
  },
  grove: {
    name: 'grove', biome: 'forest', side: 'dark soil with moss on the sides', rows: GROVE,
    palette: {
      wall: [70, 50, 34], edges: ['gs'],
      layers: { gs: [[84, 112, 52], [112, 76, 50]], ft: [[88, 96, 52], [168, 120, 72]], mp: [[88, 96, 52], [166, 166, 152]], bw: [[70, 92, 52], [176, 128, 76]] },
    },
  },
  // Biome connectors: one-sided (the lower-ranked biome wears the piece toward the harsher one); 5 pieces, the other 3 are mirrors.
  conn_meadow_grove: conn('mg', 'meadow', MEADOW_WALL, [GRASS, [96, 64, 40]], 'bright green meadow grass', 'a dark brown forest floor of fallen brown leaves'),
  conn_meadow_desert: conn('md', 'meadow', MEADOW_WALL, [GRASS, [226, 196, 140]], 'bright green meadow grass', 'golden desert sand'),
  conn_grove_desert: conn('gd', 'forest', { file: 'art_out/grove_test/atlas.png', cell: 17 }, [[84, 100, 50], [226, 196, 140]], 'a dark forest floor of brown leaves and green moss', 'golden desert sand'),
};

function conn(prefix: string, biome: string, wallRef: { file: string; cell?: number }, layer: [[number, number, number], [number, number, number]], a: string, b: string): TileSet {
  return { name: `conn_${prefix}`, biome, side: '', rows: connectRows(prefix, a, b), wallRef, palette: { wall: [100, 80, 50], edges: [prefix], layers: { [prefix]: layer } } };
}
