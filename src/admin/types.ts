// Mirrors stray-bev1/server/admin/lab_types.ts and the catalog. Admin page only, never the game.

export type Stat = 'str' | 'dex' | 'int' | 'end' | 'luck' | 'charm';
export type CoreStats = Record<Stat, number>;

export type LabMove = { name: string; level: number; equipped: boolean };
export type LabGearItem = { item: string; qty: number; slot: string | null };
export type LabFighter = {
  label: string;
  source: 'human' | 'species';
  species: string | null;
  stats: CoreStats;
  moves: LabMove[];
  row: 'front' | 'back';
  corrupted: boolean;
  count: number;
  gear?: LabGearItem[];
};

export type CatalogMove = {
  name: string;
  label: string;
  category: string;
  target: string;
  tree: string | null;
  branch: string | null;
  requires: string[];
  unlock: string[];
};

export type CatalogItem = {
  name: string;
  label: string;
  type: string;
  fits: string | null;
  stack: boolean;
  material: string | null;
  weight: number;
  defense: number;
  wield: { weaponType: string; power: number; accuracy: number; hands: number; thrown: boolean; vsArmor: Record<string, number>; grantsMove: string | null } | null;
  quality: string;
};

export type GearSlot = { slot: string; accepts: string; kind: string };

export type Catalog = {
  stats: Stat[];
  limits: { loadoutSlots: number; moveLevelCap: number };
  humanStart: { stats: CoreStats; moves: string[] };
  moves: CatalogMove[];
  species: { name: string; stats: CoreStats; moves: string[]; bodyParts: string[] }[];
  players: { id: string; name: string }[];
  gearSlots: GearSlot[];
  items: CatalogItem[];
};

export type BattleEvent = { type: string; [key: string]: unknown };
export type EntityState = { id: string; hp: number; stamina: number; mana: number; atb: number; phase: string; effects: string[] };
export type Frame = { t: number; events: BattleEvent[]; state: EntityState[] };
export type GearInfo = {
  weaponType: string | null;
  weaponPower: number;
  weaponAccuracy: number;
  vsArmor: Record<string, number>;
  punchPower: number;
  kickPower: number;
  defense: number;
  reduction: number;
  coverage: Record<string, number>;
  statAdd: Record<string, number>;
  weight: number;
  maxWeight: number;
  loadTier: number;
  thrownLeft: number | null;
};
export type EntityInfo = {
  id: string; label: string; side: string; row: string; maxHp: number; maxStamina: number; maxMana: number; moves: string[];
  gear: GearInfo;
  wear: { item: string; lost: number }[];
};
export type Growth = {
  id: string;
  stats: { stat: string; before: number; after: number; exp: number }[];
  moves: { move: string; before: number; after: number; exp: number; learned: boolean }[];
};

export type BattleResult = {
  winner: string | null;
  durationMs: number;
  entities: EntityInfo[];
  frames: Frame[];
  growth: Growth[];
  damageBy: Record<string, number>;
  carcasses: { taken: { by: string; item: string }[]; left: string[] };
};

export type ButcherRequest = { species: string; corrupted: boolean; hours: number; level: number; luck: number; rolls: number; seed: number };
export type ButcherResult = {
  carcass: string;
  totalStats: number;
  freshness: number;
  rolls: number;
  junkShare: number;
  drops: { item: string; quality: string; share: number; avgQty: number; value: number }[];
  fee: number;
  priceShop: number | null;
  priceButcher: number | null;
};

export type SessionResult = {
  wins: number;
  passedOut: number;
  lowHpStops: number;
  fightMs: number;
  sitMs: number;
  milestones: { label: string; atMs: number; fight: number }[];
  series: { fight: number; atMs: number; sitMs: number; hpTier: number; movesKnown: number; outcome: string }[];
  moves: { name: string; level: number }[];
  stats: Record<string, number>;
};
