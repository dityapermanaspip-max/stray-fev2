import Phaser from 'phaser';
import type { FieldView } from '../../../stray-bev1/shared/field.ts';
import { hasTiles } from '../assets/manifest.ts';
import { loadSheets, place, sheetOf } from '../field/ground_tiles.ts';
import { tileLook } from '../field/tile_rules.ts';

// The battle ground made of the field's own tiles: every board tile is the terrain the fight started on, picked by the
// field's use table (same variants, same hash per position). Answers false when the biome has no sheet, so board.ts
// keeps its plain checkerboard.
export async function drawBoardTiles(scene: Phaser.Scene, ground: { biome: string; terrain: string }, cols: number, rows: number): Promise<boolean> {
  if (!hasTiles(ground.biome)) return false;
  await loadSheets(scene, [ground.biome]);
  const sheet = sheetOf(scene, ground.biome);
  if (!sheet || !scene.sys.isActive()) return false;
  const tile = { t: ground.terrain, b: ground.biome, h: 0, w: true, s: -1, safe: false, door: null };
  const view: FieldView = { ref: 'battle', kind: 'open', width: cols, height: rows, tiles: Array.from({ length: cols * rows }, () => tile), exits: [], nodes: [], npcs: [] };
  let drawn = false;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const look = tileLook(sheet.table, sheet.frames, ground.biome, view, y * cols + x);
      if (!look) continue;
      place(scene, sheet, look.frame, x, y, 0, -9);
      drawn = true;
    }
  }
  return drawn;
}
