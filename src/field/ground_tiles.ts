import Phaser from 'phaser';
import type { FieldView } from '../../../stray-bev1/shared/field.ts';
import { hasTiles, tileAssets } from '../assets/manifest.ts';
import { drawBuildings } from './buildings.ts';
import { pickNode, pickRow } from './catalog_pick.ts';
import { loadCatalog } from './catalog_tiles.ts';
import { drawGround, type SpriteGround } from './ground.ts';
import { drawOrder, surfaceHeight, TILE_W, tileCenter } from './iso.ts';
import { fillerLevels, parseUseTable, tileLook, type UseTable } from './tile_rules.ts';

// Field ground from tile sheets: each tile is a column of filler blocks with its own frame on top, placed by the
// frame's pivot (its top-face centre) on the tile's centre. Biomes without a sheet and terrains the use table does
// not name keep the plain-colour ground. A resource node on a flat tile uses the table's node frame when it has one;
// exits, doors, other nodes and obstacle marks are drawn over the sprites by ground.ts. A biome's atlas loads the
// first time a field of that biome is shown.

export type Sheet = { table: UseTable; frames: string[]; scale: number; atlasKey: string };

export async function loadSheets(scene: Phaser.Scene, biomes: string[]): Promise<void> {
  const missing = biomes.filter((b) => !scene.textures.exists(tileAssets(b).atlasKey));
  if (missing.length === 0) return;
  for (const b of missing) {
    const a = tileAssets(b);
    scene.load.atlas(a.atlasKey, a.image, a.atlas);
    scene.load.json(a.useKey, a.use);
  }
  const failed = (file: Phaser.Loader.File) => console.warn(`tile sheet missing: ${file.src}`);
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, failed);
  await new Promise<void>((done) => {
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => done());
    scene.load.start();
  });
  scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, failed);
}

export function sheetOf(scene: Phaser.Scene, biome: string): Sheet | null {
  const a = tileAssets(biome);
  const raw = scene.cache.json.get(a.useKey) as Record<string, unknown> | undefined;
  if (!scene.textures.exists(a.atlasKey) || !raw) return null;
  const texture = scene.textures.get(a.atlasKey);
  const meta = (texture.customData as { meta?: { tileWidth?: number } }).meta;
  const tileWidth = Number(meta?.tileWidth);
  if (!(tileWidth > 0)) return null;
  return { table: parseUseTable(raw), frames: texture.getFrameNames(), scale: TILE_W / tileWidth, atlasKey: a.atlasKey };
}

export function place(scene: Phaser.Scene, sheet: Sheet, frame: string, x: number, y: number, h: number, depth: number): void {
  const at = tileCenter(x, y, h);
  const img = scene.add.image(at.x, at.y, sheet.atlasKey, frame).setScale(sheet.scale).setDepth(depth);
  if (img.frame.customPivot) img.setOrigin(img.frame.pivotX, img.frame.pivotY);
}

// Draws the field's ground. Resolves once it is on screen (or right away if the scene closed while sheets loaded).
export async function drawField(scene: Phaser.Scene, view: FieldView): Promise<void> {
  const biomes = [...new Set(view.tiles.map((t) => t.b))].filter(hasTiles);
  await loadSheets(scene, biomes);
  const [built, catalog] = await Promise.all([drawBuildings(scene, view), loadCatalog(scene)]);
  if (!scene.sys.isActive()) return;
  const sheets = new Map(biomes.map((b) => [b, sheetOf(scene, b)] as const));
  const sprited: SpriteGround = new Map();
  const nodes = new Map(view.nodes.map((n) => [n.y * view.width + n.x, n.kind]));
  for (const i of drawOrder(view)) {
    const tile = view.tiles[i];
    const sheet = sheets.get(tile.b);
    const look = sheet ? tileLook(sheet.table, sheet.frames, tile.b, view, i, nodes.get(i) ?? null) : null;
    if (built.has(i)) continue;
    const x = i % view.width, y = Math.floor(i / view.width);
    const row = (x + y) * 10; // the row's plain-colour ground and marks draw at row depth, over these
    const kind = nodes.get(i);
    const landmark = kind && catalog && tile.h === 0 && tile.s < 0 ? pickNode(catalog.rows, tile.b, kind, x, y) : null; // a big obstacle stands for the node
    if (landmark) {
      place(scene, catalog!.sheets.obstacle, landmark.key, x, y, 0, row - 1);
      sprited.set(i, { marker: false, node: true });
      continue;
    }
    const drawn = !sheet || !look ? catalog && tile.h === 0 && tile.s < 0 ? pickRow(catalog.rows, view, i) : null : null; // no biome sheet: the catalog
    if (drawn) {
      place(scene, catalog!.sheets[drawn.atlas], drawn.key, x, y, 0, row - 1);
      sprited.set(i, { marker: false, node: drawn.atlas === 'obstacle' });
      continue;
    }
    if (!sheet || !look) continue;
    if (sheet.frames.includes(sheet.table.filler)) {
      for (const k of fillerLevels(tile.h, sheet.table.blockLevels)) place(scene, sheet, sheet.table.filler, x, y, k, row - 2);
    }
    place(scene, sheet, look.frame, x, y, surfaceHeight(tile), row - 1); // a slope's pivot sits at its middle
    sprited.set(i, { marker: look.marker, node: look.node });
  }
  drawGround(scene, view, sprited, built);
}
