import { actorAssets, PLAYER_ACTOR } from '../../assets/manifest.ts';

// The body figure of the status window: one standing pose of an actor sheet, cut out of its atlas with CSS (no canvas).
// The frame list comes from the same atlas json the game uses; until it loads the figure box stays empty.

type Atlas = { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>; meta: { size: { w: number; h: number } } };
const cache = new Map<string, Promise<Atlas | null>>();

const atlasOf = (look: string): Promise<Atlas | null> => {
  if (!cache.has(look)) cache.set(look, fetch(actorAssets(look).atlas).then((r) => (r.ok ? (r.json() as Promise<Atlas>) : null)).catch(() => null));
  return cache.get(look)!;
};

export function makeFigure(height: number, look = PLAYER_ACTOR, pose = 'stand'): HTMLElement {
  const box = Object.assign(document.createElement('div'), { className: 'figure' });
  box.style.height = `${height}px`;
  void atlasOf(look).then((atlas) => {
    const f = atlas?.frames[pose]?.frame;
    if (!atlas || !f) return;
    const k = height / f.h;
    Object.assign(box.style, {
      width: `${f.w * k}px`, backgroundImage: `url(${actorAssets(look).image})`, backgroundRepeat: 'no-repeat',
      backgroundSize: `${atlas.meta.size.w * k}px ${atlas.meta.size.h * k}px`, backgroundPosition: `${-f.x * k}px ${-f.y * k}px`,
    });
  });
  return box;
}
