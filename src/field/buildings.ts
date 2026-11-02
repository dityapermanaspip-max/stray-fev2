import Phaser from 'phaser';
import type { FieldView } from '../../../stray-bev1/shared/field.ts';
import { BUILDING_TABLE, buildingAssets } from '../assets/manifest.ts';
import { TILE_W, tileCenter } from './iso.ts';

// Town buildings drawn from sheets: each block of building tiles gets one building from the styles its biome uses
// (public/assets/world/town/buildings/buildings.json), scaled to the block's width. A block with a door takes the
// building (or its mirror) whose art door sits closest to the server's door; door-less blocks (houses) take door-less
// art. A small lamp marks each real door over the art, and a building turns see-through while it covers the player.
// Looks only; the server's tiles decide where anyone can walk. ground.ts skips the tiles a building covers.

type Face = 'L' | 'R';
type Style = { doors?: Record<string, [Face, number]> };
type Table = { styles: Record<string, Style>; biomes: Record<string, string[]> };
type Door = { face: Face; t: number }; // L: the +y side, R: the +x side; t from the face's left end on screen
type Block = { x0: number; y0: number; x1: number; y1: number; h: number; biome: string; door: (Door & { x: number; y: number }) | null };
type Choice = { key: string; f: string; door: Door | null };

const FIT = 0.85; // building unit width / the block's width on screen (a little under, so neighbours do not touch)
const BASE_COLOR = 0x8d8170;
const LAMP_COLOR = 0xffd27a;
const SEE_THROUGH = 0.4; // alpha of a building in front of the player
const WRONG_FACE = 10; // pick cost: art door on the other face
const NO_DOOR_ART = 5; // pick cost: a service block on door-less art, or a house on art with a door

const isBuilding = (t: { t: string; door: string | null }) => t.t === 'building' || t.door !== null;
const drawnBy = new WeakMap<Phaser.Scene, Phaser.GameObjects.Image[]>();

// Blocks of building tiles (4-neighbour), with their bounds and where the door is.
function findBlocks(view: FieldView): { blocks: Block[]; cover: Set<number> } {
  const seen = new Set<number>();
  const blocks: Block[] = [];
  view.tiles.forEach((tile, start) => {
    if (seen.has(start) || !isBuilding(tile)) return;
    const b: Block = { x0: view.width, y0: view.height, x1: -1, y1: -1, h: tile.h, biome: tile.b, door: null };
    const stack = [start];
    const doors: number[] = [];
    seen.add(start);
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % view.width, y = Math.floor(i / view.width);
      Object.assign(b, { x0: Math.min(b.x0, x), y0: Math.min(b.y0, y), x1: Math.max(b.x1, x), y1: Math.max(b.y1, y) });
      if (view.tiles[i].door) doors.push(i);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const n = ny * view.width + nx;
        if (nx < 0 || ny < 0 || nx >= view.width || ny >= view.height || seen.has(n) || !isBuilding(view.tiles[n])) continue;
        seen.add(n);
        stack.push(n);
      }
    }
    if (doors[0] !== undefined) {
      const x = doors[0] % view.width, y = Math.floor(doors[0] / view.width);
      const w = b.x1 - b.x0 + 1, d = b.y1 - b.y0 + 1;
      b.door = x === b.x1 && y !== b.y1 ? { x, y, face: 'R', t: (b.y1 - y + 0.5) / d } : { x, y, face: 'L', t: (x - b.x0 + 0.5) / w };
    }
    blocks.push(b);
  });
  return { blocks, cover: seen };
}

function hash(x: number, y: number): number {
  let h = Math.imul(x + 7, 0x27d4eb2d) ^ Math.imul(y + 3, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return (h ^ (h >>> 13)) >>> 0;
}

// How badly a frame (mirrored or not) fits the block's door. Lower is better.
function cost(c: Choice, flip: boolean, want: Door | null): number {
  if (!want || !c.door) return want || c.door ? NO_DOOR_ART : 0;
  const face = flip ? (c.door.face === 'L' ? 'R' : 'L') : c.door.face;
  const t = flip ? 1 - c.door.t : c.door.t;
  return (face === want.face ? 0 : WRONG_FACE) + Math.abs(t - want.t);
}

// The best unused frame and mirror for the block (used frames only when none is left); ties go by position.
function choose(frames: Choice[], used: Set<string>, b: Block): { c: Choice; flip: boolean } | null {
  const fresh = frames.filter((c) => !used.has(c.f));
  const pool = fresh.length ? fresh : frames;
  const salt = hash(b.x0, b.y0);
  let best: { c: Choice; flip: boolean; score: number } | null = null;
  pool.forEach((c, i) => {
    for (const flip of [false, true]) {
      const score = cost(c, flip, b.door) + (((salt + i * 2 + Number(flip)) % 97) / 97) * 0.01;
      if (!best || score < best.score) best = { c, flip, score };
    }
  });
  return best;
}

const loaded = (scene: Phaser.Scene) =>
  new Promise<void>((done) => { scene.load.once(Phaser.Loader.Events.COMPLETE, () => done()); scene.load.start(); });

async function loadTable(scene: Phaser.Scene): Promise<Table | null> {
  if (!scene.cache.json.exists(BUILDING_TABLE.key)) {
    scene.load.json(BUILDING_TABLE.key, BUILDING_TABLE.path);
    await loaded(scene);
  }
  const table = scene.cache.json.get(BUILDING_TABLE.key) as Table | undefined;
  return table?.biomes && table.styles ? table : null;
}

async function loadStyles(scene: Phaser.Scene, styles: string[]): Promise<void> {
  const missing = styles.filter((s) => !scene.textures.exists(buildingAssets(s).atlasKey));
  if (missing.length === 0) return;
  for (const s of missing) scene.load.atlas(buildingAssets(s).atlasKey, buildingAssets(s).image, buildingAssets(s).atlas);
  await loaded(scene);
}

const stylesOf = (table: Table, biome: string) => table.biomes[biome] ?? table.biomes.default ?? [];

function framesOf(scene: Phaser.Scene, table: Table, biome: string): Choice[] {
  return stylesOf(table, biome).flatMap((s) => {
    const key = buildingAssets(s).atlasKey;
    if (!scene.textures.exists(key)) return [];
    return scene.textures.get(key).getFrameNames().map((f) => {
      const d = table.styles[s]?.doors?.[f.slice(-2)];
      return { key, f, door: d ? { face: d[0], t: d[1] } : null };
    });
  });
}

// Draws the field's buildings. Answers the tiles they cover (ground.ts leaves those out); empty when there are no
// buildings or their sheets cannot be loaded, so the plain-colour blocks stay.
export async function drawBuildings(scene: Phaser.Scene, view: FieldView): Promise<Set<number>> {
  const { blocks, cover } = findBlocks(view);
  if (blocks.length === 0) return new Set();
  const table = await loadTable(scene);
  if (table) await loadStyles(scene, [...new Set(blocks.flatMap((b) => stylesOf(table, b.biome)))]);
  if (!table || !scene.sys.isActive()) return new Set();
  const drawn = new Set<number>();
  const used = new Set<string>(); // each building once per field before any repeats
  const images: Phaser.GameObjects.Image[] = [];
  // Service blocks pick first, so the art with doors goes to them.
  for (const b of [...blocks].sort((p, q) => Number(!!q.door) - Number(!!p.door))) {
    const pick = choose(framesOf(scene, table, b.biome), used, b);
    if (!pick) continue;
    used.add(pick.c.f);
    drawBase(scene, b);
    const w = b.x1 - b.x0 + 1, d = b.y1 - b.y0 + 1;
    const mid = tileCenter((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.h);
    const meta = (scene.textures.get(pick.c.key).customData as { meta?: { unitWidth?: number } }).meta;
    const img = scene.add.image(mid.x, mid.y, pick.c.key, pick.c.f);
    img.setScale(((w + d) * TILE_W) / 2 / (meta?.unitWidth ?? img.width) * FIT);
    if (img.frame.customPivot) img.setOrigin(pick.flip ? 1 - img.frame.pivotX : img.frame.pivotX, img.frame.pivotY);
    img.setFlipX(pick.flip);
    // In front of the rows behind the block, behind anyone standing on a tile beside its front (exact for near-square blocks).
    img.setDepth(Math.max(b.x1 + b.y0, b.x0 + b.y1) * 10 + 4);
    images.push(img);
    if (b.door) drawLamp(scene, b.door, b.h, img.depth + 1);
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) drawn.add(y * view.width + x);
  }
  drawnBy.set(scene, images);
  return new Set([...cover].filter((i) => drawn.has(i)));
}

// Buildings in front of the given figure turn see-through; the rest stay solid. Called every frame.
export function fadeBuildings(scene: Phaser.Scene, figure: Phaser.GameObjects.Container | undefined): void {
  for (const img of drawnBy.get(scene) ?? []) {
    const covers = !!figure && figure.depth < img.depth && img.getBounds().contains(figure.x, figure.y - TILE_W * 0.4);
    img.setAlpha(covers ? SEE_THROUGH : 1);
  }
}

// A small lamp at the foot of the door's face, so the real door reads even where the art differs.
function drawLamp(scene: Phaser.Scene, door: Block['door'] & {}, h: number, depth: number): void {
  const half = door.face === 'R' ? { x: 0.5, y: 0 } : { x: 0, y: 0.5 };
  const at = tileCenter(door.x + half.x, door.y + half.y, h);
  const glow = scene.add.ellipse(at.x, at.y - 6, 18, 9, LAMP_COLOR, 0.35).setDepth(depth);
  scene.add.circle(at.x, at.y - 6, 3, LAMP_COLOR).setDepth(depth);
  scene.tweens.add({ targets: glow, alpha: 0.12, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

// The block's flat ground: one diamond over all its tiles, under everything standing on it.
function drawBase(scene: Phaser.Scene, b: Block): void {
  const c = (x: number, y: number) => tileCenter(x, y, b.h);
  const top = c(b.x0 - 0.5, b.y0 - 0.5), right = c(b.x1 + 0.5, b.y0 - 0.5), bottom = c(b.x1 + 0.5, b.y1 + 0.5), left = c(b.x0 - 0.5, b.y1 + 0.5);
  const g = scene.add.graphics().setDepth((b.x0 + b.y0) * 10 + 1);
  g.fillStyle(BASE_COLOR);
  g.fillPoints([top, right, bottom, left].map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
}
