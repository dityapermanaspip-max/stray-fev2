import type { FieldView } from '../../../stray-bev1/shared/field.ts';
import { connectName } from '../assets/manifest.ts';
import { sideFor, type Side } from './tile_rules.ts';

// Biome connector tiles (one-sided rule). Where a tile of a gentler biome has a neighbour of a harsher biome (higher in
// view.rank), it wears the half-and-half piece of that pair toward the neighbour; the harsher biome stays plain.
// Pure: no Phaser. Looks only.

const SIDE_OF: Record<string, Side> = { '-1,0': 'ul', '0,-1': 'ur', '1,0': 'lr', '0,1': 'll' };
export const PIECE: Record<Side, string> = {
  ll: 'edge_bl', ul: 'edge_tl', lr: 'edge_br', ur: 'edge_tr', top: 'corner_t', bottom: 'corner_b', left: 'corner_l', right: 'corner_r',
};

export type Connector = { sheet: string; frame: string }; // the pair's sheet name and the frame on it

// The piece for tile i, or null: the tile's terrain must be one the biome lets wear a connector (`connects`), a pair
// sheet must exist, and the harsher neighbour must touch one side or two adjacent sides (three or four: plain).
export function connectorFor(view: FieldView, i: number, connects: readonly string[]): Connector | null {
  const tile = view.tiles[i];
  const mine = view.rank.indexOf(tile.b);
  if (mine < 0 || !connects.includes(tile.t)) return null;
  const x = i % view.width, y = Math.floor(i / view.width);
  let sheet: string | null = null;
  const sides: Side[] = [];
  for (const [key, side] of Object.entries(SIDE_OF)) {
    const [dx, dy] = key.split(',').map(Number);
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= view.width || ny >= view.height) continue;
    const other = view.tiles[ny * view.width + nx].b;
    if (view.rank.indexOf(other) <= mine) continue; // same or gentler: no piece toward it
    const name = connectName(tile.b, other);
    if (!name || (sheet && name !== sheet)) continue; // one harsher biome at a time
    sheet = name;
    sides.push(side);
  }
  const side = sheet ? sideFor(sides) : null;
  return side && sheet ? { sheet, frame: `${sheet}_${PIECE[side]}` } : null;
}
