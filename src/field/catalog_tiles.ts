import Phaser from 'phaser';
import { catalogAssets, CATALOG_ATLASES } from '../assets/manifest.ts';
import { byTerrain, type Catalog, type CatalogRow } from './catalog_pick.ts';
import type { Sheet } from './ground_tiles.ts';
import { TILE_W } from './iso.ts';
import { parseUseTable } from './tile_rules.ts';

// The tile catalog at runtime: the rows and the three atlases (walk, block, obstacle), loaded once per game.
// A missing file leaves null, and the field keeps its plain-colour ground.

export type LoadedCatalog = { rows: Catalog; sheets: Record<string, Sheet> };

export async function loadCatalog(scene: Phaser.Scene): Promise<LoadedCatalog | null> {
  const a = catalogAssets();
  const missing = CATALOG_ATLASES.some((n) => !scene.textures.exists(a.atlas(n).key));
  if (missing || !scene.cache.json.exists(a.rowsKey)) {
    scene.load.json(a.rowsKey, a.rows);
    for (const n of CATALOG_ATLASES) if (!scene.textures.exists(a.atlas(n).key)) scene.load.atlas(a.atlas(n).key, a.atlas(n).image, a.atlas(n).json);
    let failed = false;
    const fail = (file: Phaser.Loader.File) => { failed = true; console.warn(`tile catalog file missing: ${file.src}`); };
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, fail);
    await new Promise<void>((done) => {
      scene.load.once(Phaser.Loader.Events.COMPLETE, () => done());
      scene.load.start();
    });
    scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, fail);
    if (failed) return null;
  }
  const raw = scene.cache.json.get(a.rowsKey) as { tiles: CatalogRow[] } | undefined;
  if (!raw) return null;
  const sheets: Record<string, Sheet> = {};
  for (const n of CATALOG_ATLASES) {
    const texture = scene.textures.get(a.atlas(n).key);
    const tileWidth = Number((texture.customData as { meta?: { tileWidth?: number } }).meta?.tileWidth);
    if (!(tileWidth > 0)) return null;
    sheets[n] = { table: parseUseTable({ filler: '' }), frames: texture.getFrameNames(), scale: TILE_W / tileWidth, atlasKey: a.atlas(n).key };
  }
  return { rows: byTerrain(raw.tiles), sheets };
}
