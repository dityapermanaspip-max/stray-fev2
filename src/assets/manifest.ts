// Asset keys and paths. Scenes use these keys, never raw paths.

const TILE_DIR = 'assets/world/tiles';

// Biomes with a ground tile sheet (sliced by `npm run tiles:slice -- <biome>`). Other biomes keep the plain-colour ground.
export const TILE_BIOMES = ['meadow', 'grove', 'desert', 'volcano', 'snow', 'seashore'] as const;

export const tileAssets = (biome: string) => ({
  atlasKey: `tiles_${biome}`, // the sheet with its frames (<biome>.json, made by the slicer)
  useKey: `tiles_${biome}_use`, // the hand-written use table (<biome>.tiles.json)
  image: `${TILE_DIR}/${biome}/${biome}_atlas.png`, // packed by the slicer from the biome's sheets
  atlas: `${TILE_DIR}/${biome}/${biome}.json`,
  use: `${TILE_DIR}/${biome}/${biome}.tiles.json`,
});

// Biome connector sheets: `connect_<gentler>_<harsher>`, a tileAssets() name like a biome (sliced by tiles:slice).
const CONNECTORS = ['meadow_grove', 'meadow_desert', 'grove_desert'];
export const connectName = (low: string, high: string) => (CONNECTORS.includes(`${low}_${high}`) ? `connect_${low}_${high}` : null);

export const hasTiles = (biome: string) => (TILE_BIOMES as readonly string[]).includes(biome);

// The tile catalog (world.tiles): its rows as a file and three atlases, made by tools/tiles/catalog.ts.
export const CATALOG_ATLASES = ['walk', 'block', 'obstacle'] as const;
export const catalogAssets = () => ({
  rowsKey: 'tile_catalog',
  rows: `${TILE_DIR}/catalog/catalog.json`,
  atlas: (name: string) => ({ key: `catalog_${name}`, image: `${TILE_DIR}/catalog/catalog_${name}_atlas.png`, json: `${TILE_DIR}/catalog/catalog_${name}.json` }),
});

const ACTOR_DIR = 'assets/actors';

// An actor sheet sliced by `npm run actors:slice -- <path>` (path under public/assets/actors, without extension).
export const actorAssets = (sheet: string) => ({
  atlasKey: `actor_${sheet.split('/').pop()}`,
  image: `${ACTOR_DIR}/${sheet}_atlas.png`,
  atlas: `${ACTOR_DIR}/${sheet}.json`,
});

// The look every player has for now (one sheet until characters pick their own).
export const PLAYER_ACTOR = 'characters/human/tourist/tourist';

const BUILDING_DIR = 'assets/world/town/buildings';

// Town building looks: one table (styles per biome) and an atlas per style, sliced by `npm run buildings:slice`.
export const BUILDING_TABLE = { key: 'buildings_use', path: `${BUILDING_DIR}/buildings.json` };
export const buildingAssets = (style: string) => ({
  atlasKey: `buildings_${style}`,
  image: `${BUILDING_DIR}/${style}/${style}_atlas.png`,
  atlas: `${BUILDING_DIR}/${style}/${style}.json`,
});
