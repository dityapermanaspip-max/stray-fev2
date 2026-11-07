import Phaser from 'phaser';
import { depthAt, TILE_H, TILE_W, tileCenter, type Point } from '../field/iso.ts';
import { drawBoardTiles } from './board_ground.ts';

// The battle board: a flat 7 x 11 isometric field, same tile size and same ground tiles as the field the fight started
// on. The party stands at the near end (bottom left on screen, high y) and faces up-right; the foes stand at the far end
// (top right) and face down-left. Front slots
// sit on every other column (0, 2, 4, 6) and back slots between them (1, 3, 5), so the back row shows through.

export const BOARD = { cols: 7, rows: 11 };
const ROW_Y = { party: { front: 7, back: 9 }, enemy: { front: 3, back: 1 } };
const SIDE_SHIFT = { party: -1, enemy: 1 }; // columns: the party leans to the left corner, the foes to the right one
const LIGHT = 0x5d6b45;
const DARK = 0x52603d;
const EDGE = 0x2c3322;
const MENU_SPACE = 230; // screen pixels under the board kept for the sentence box and the move menu
const SIDE_SPACE = 230; // screen pixels at the left kept for the turn order and the party cards (wide screens)
const TOP_SPACE = 110; // screen pixels over the far row for the foes' figures

export type Side = 'party' | 'enemy';

// The tile of a formation slot (1-based, front slots first).
export function slotTile(side: Side, slot: number, formation: { front: number; back: number }): Point {
  const back = slot > formation.front;
  const i = back ? slot - formation.front - 1 : slot - 1;
  const count = back ? formation.back : formation.front;
  const step = count > 1 ? Math.min(2, (BOARD.cols - 1) / (count - 1)) : 0;
  const x = Math.round((BOARD.cols - 1) / 2 + SIDE_SHIFT[side] + (i - (count - 1) / 2) * step);
  return { x: Math.max(0, Math.min(BOARD.cols - 1, x)), y: ROW_Y[side][back ? 'back' : 'front'] };
}

export const slotPoint = (side: Side, slot: number, formation: { front: number; back: number }) => {
  const t = slotTile(side, slot, formation);
  return { ...tileCenter(t.x, t.y, 0), depth: depthAt(t.x, t.y) };
};

// The flat ground: the field tile's biome tiles under everything; a two-tone checkerboard when that biome has no sheet.
export async function drawBoard(scene: Phaser.Scene, ground: { biome: string; terrain: string }): Promise<void> {
  if (await drawBoardTiles(scene, ground, BOARD.cols, BOARD.rows)) return;
  if (!scene.sys.isActive()) return;
  const g = scene.add.graphics().setDepth(-10);
  for (let y = 0; y < BOARD.rows; y++) {
    for (let x = 0; x < BOARD.cols; x++) {
      const c = tileCenter(x, y, 0);
      const pts = [[0, -TILE_H / 2], [TILE_W / 2, 0], [0, TILE_H / 2], [-TILE_W / 2, 0]].map(([dx, dy]) => new Phaser.Math.Vector2(c.x + dx, c.y + dy));
      g.fillStyle((x + y) % 2 ? DARK : LIGHT).fillPoints(pts, true);
      g.lineStyle(1, EDGE, 0.35).strokePoints(pts, true);
    }
  }
}

// Zooms and centres the camera so the whole board fits above the menu.
export function fitBoard(scene: Phaser.Scene): void {
  const { width, height } = scene.scale;
  const left = tileCenter(0, BOARD.rows - 1, 0).x - TILE_W / 2, right = tileCenter(BOARD.cols - 1, 0, 0).x + TILE_W / 2;
  const top = -TILE_H / 2 - TOP_SPACE, bottom = tileCenter(BOARD.cols - 1, BOARD.rows - 1, 0).y + TILE_H / 2;
  const side = width > 760 ? SIDE_SPACE : 0;
  const zoom = Math.min((width - side) / (right - left + 32), Math.max(120, height - MENU_SPACE) / (bottom - top));
  const cam = scene.cameras.main.setZoom(zoom);
  // Keep the board's middle in the middle of the space above the menu.
  const shift = MENU_SPACE / 2 / zoom;
  cam.centerOn((left + right) / 2 - side / 2 / zoom, (top + bottom) / 2 + shift);
}
