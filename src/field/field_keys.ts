import type { FieldView } from '../../../stray-bev1/shared/field.ts';

// Keyboard for the field, beside mouse and touch. Arrows or WASD walk (held keys keep walking); diagonals follow the
// screen: up is up the screen, so it walks toward the tile above. Enter or Space says yes to a question, Esc says no
// or closes the open panel. M opens the world map, I or C the status window, + and - zoom.
// Keys typed into a text field are left alone.

export type Step = { dx: number; dy: number };
export type KeyActions = { confirm: () => void; cancel: () => void; map: () => void; status: () => void; zoom: (dir: 1 | -1) => void };

const DIRS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};
// Screen directions in tile steps (x runs down-right on screen, y down-left).
const SCREEN: Record<'up' | 'down' | 'left' | 'right', Step> = {
  up: { dx: -1, dy: -1 }, down: { dx: 1, dy: 1 }, left: { dx: -1, dy: 1 }, right: { dx: 1, dy: -1 },
};

// The tile a keyboard step lands on: the step itself, or one of its two sides when a diagonal is blocked.
// Only a walkable tile on the map, or a resource node (a step into one asks to work it from where you stand);
// the server still decides whether the walk happens.
export function nextTile(v: FieldView, at: { x: number; y: number }, step: Step): { x: number; y: number } | null {
  const tries = [step, { dx: step.dx, dy: 0 }, { dx: 0, dy: step.dy }].filter((t) => t.dx !== 0 || t.dy !== 0);
  for (const t of tries) {
    const x = at.x + t.dx, y = at.y + t.dy;
    if (x >= 0 && y >= 0 && x < v.width && y < v.height && v.tiles[y * v.width + x]?.w) return { x, y };
    if ((t.dx === 0 || t.dy === 0) && v.nodes.some((n) => n.x === x && n.y === y)) return { x, y };
  }
  return null;
}

const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

export class FieldKeys {
  private held = new Set<'up' | 'down' | 'left' | 'right'>();
  private tap: Step | null = null; // a press shorter than a frame still takes one step

  constructor(private actions: KeyActions) {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.clear);
  }

  // The step the held keys point at (or the last quick tap), or null. Up + right is one tile up-right, and so on.
  step(): Step | null {
    return this.fromHeld() ?? this.tap;
  }

  // The scene sent a step: a tap is used up.
  took(): void {
    this.tap = null;
  }

  private fromHeld(): Step | null {
    let dx = 0, dy = 0;
    for (const d of this.held) { dx += SCREEN[d].dx; dy += SCREEN[d].dy; }
    dx = Math.sign(dx);
    dy = Math.sign(dy);
    return dx === 0 && dy === 0 ? null : { dx, dy };
  }

  clear = () => {
    this.held.clear();
    this.tap = null;
  };

  destroy(): void {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.clear);
  }

  private down = (e: KeyboardEvent) => {
    if (typing(e)) return;
    const dir = DIRS[e.code];
    if (dir) {
      this.held.add(dir);
      this.tap = this.fromHeld();
      e.preventDefault(); // arrows would scroll the page
      return;
    }
    if (e.repeat) return;
    switch (e.code) {
      case 'Enter': case 'Space': e.preventDefault(); return this.actions.confirm();
      case 'Escape': return this.actions.cancel();
      case 'KeyM': return this.actions.map();
      case 'KeyI': case 'KeyC': return this.actions.status();
      case 'Equal': case 'NumpadAdd': return this.actions.zoom(1);
      case 'Minus': case 'NumpadSubtract': return this.actions.zoom(-1);
    }
  };

  private up = (e: KeyboardEvent) => {
    const dir = DIRS[e.code];
    if (dir) this.held.delete(dir);
  };
}
