import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FieldView } from '../../stray-bev1/shared/field.ts';
import { connectorFor } from '../src/field/connect.ts';

// A 3 x 1 strip, then a 3 x 3 square: biomes by position, all "grass" terrain.
const view = (biomes: string[][], rank = ['meadow', 'grove', 'desert']): FieldView => ({
  ref: 't', rank, kind: 'corridor', width: biomes[0].length, height: biomes.length, exits: [], nodes: [], npcs: [],
  tiles: biomes.flat().map((b) => ({ t: 'grass', b, h: 0, w: true, s: -1, safe: false, door: null })),
});
const GRASS = ['grass'];

test('the gentler biome wears the piece, the harsher one stays plain (one-sided)', () => {
  const v = view([['meadow', 'grove']]);
  assert.deepEqual(connectorFor(v, 0, GRASS), { sheet: 'connect_meadow_grove', frame: 'connect_meadow_grove_edge_br' }); // grove lies at +x (lower right)
  assert.equal(connectorFor(v, 1, GRASS), null);
});

test('the side is where the harsher biome lies, a corner when two sides touch', () => {
  const v = view([['grove', 'grove'], ['meadow', 'grove']]);
  assert.equal(connectorFor(v, 2, GRASS)?.frame, 'connect_meadow_grove_corner_r'); // grove at -y (top right) and +x (lower right) -> right
});

test('three sides, an unknown pair, a terrain the biome does not list, and same rank give no piece', () => {
  assert.equal(connectorFor(view([['grove', 'grove', 'grove'], ['grove', 'meadow', 'grove']]), 4, GRASS), null);
  assert.equal(connectorFor(view([['meadow', 'snow']], ['meadow', 'snow']), 0, GRASS), null);
  assert.equal(connectorFor(view([['meadow', 'grove']]), 0, ['dirt']), null);
  assert.equal(connectorFor(view([['meadow', 'meadow']]), 0, GRASS), null);
});
