import type { BattleMoveView, BattleResultView } from '../../../stray-bev1/shared/battle.ts';
import './battle.css';

// DOM parts of the battle screen: the 8-slot move menu, the sentence box (visual novel style) and the
// result panel. Text comes from the server; the only marks made here are slot numbers and symbols.

const LINE_MS = 3200;
const MAX_LINES = 3;

export type OverlayHandlers = { pick: (move: BattleMoveView) => void; done: () => void; auto: (on: boolean) => void };

export class BattleOverlay {
  private root = document.createElement('div');
  private menu = document.createElement('div');
  private box = document.createElement('div');
  private buttons = new Map<string, HTMLButtonElement>();
  private front: string[] = []; // moves only usable from the front row
  private dice?: HTMLButtonElement;
  private auto = false;

  constructor(moves: BattleMoveView[], slots: number, private handlers: OverlayHandlers) {
    this.root.className = 'battle-ui';
    this.menu.className = 'battle-menu';
    this.box.className = 'battle-box';
    for (let slot = 1; slot <= slots; slot++) {
      const move = moves.find((m) => m.slot === slot);
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<span class="slot">${slot}</span>`;
      b.append(move ? move.name : '');
      b.disabled = !move;
      if (move) {
        b.addEventListener('click', () => handlers.pick(move));
        this.buttons.set(move.move, b);
        if (move.front) this.front.push(move.move);
      }
      this.menu.append(b);
    }
    // The dice: fight on its own, by the AI's rule (a random usable equipped move). Tap again, or press R, to take over.
    const dice = document.createElement('button');
    dice.type = 'button';
    dice.className = 'auto-button';
    dice.textContent = '🎲';
    dice.addEventListener('click', () => this.toggleAuto());
    this.menu.append(dice);
    this.dice = dice;
    this.root.append(this.box, this.menu);
    document.body.append(this.root);
    window.addEventListener('keydown', this.onKey);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'r' || e.key === 'R') return this.toggleAuto();
    const slot = Number(e.key);
    if (!Number.isInteger(slot) || slot < 1) return;
    this.menu.children[slot - 1]?.dispatchEvent(new MouseEvent('click'));
  };

  private toggleAuto(): void {
    if (this.menu.classList.contains('locked')) return;
    this.auto = !this.auto;
    this.menu.classList.toggle('auto', this.auto);
    this.dice?.classList.toggle('on', this.auto);
    this.handlers.auto(this.auto);
  }

  // ready: the gauge is full and nothing is queued. choosing: picking a target for this move. queued: waits for the gauge.
  mark(state: { ready: boolean; choosing: string | null; queued: string | null }): void {
    this.menu.classList.toggle('ready', state.ready);
    for (const [move, b] of this.buttons) {
      b.classList.toggle('choosing', move === state.choosing);
      b.classList.toggle('queued', move === state.queued);
    }
  }

  // Greys the front-row-only moves while the player stands in the back row.
  reach(back: boolean): void {
    for (const move of this.front) this.buttons.get(move)!.disabled = back || this.menu.classList.contains('locked');
  }

  lock(): void {
    this.menu.classList.add('locked');
    for (const b of this.buttons.values()) b.disabled = true;
  }

  say(text: string, speaker: string | null): void {
    const p = document.createElement('p');
    if (speaker) {
      const who = document.createElement('b');
      who.textContent = speaker;
      p.append(who, ' ');
    }
    p.append(text);
    this.box.append(p);
    while (this.box.children.length > MAX_LINES) this.box.firstElementChild?.remove();
    setTimeout(() => p.classList.add('old'), LINE_MS);
  }

  result(r: BattleResultView): void {
    this.lock();
    const panel = document.createElement('div');
    panel.className = `battle-result ${r.won ? 'won' : 'lost'}`;
    for (const line of r.lines) {
      const p = document.createElement('p');
      p.textContent = line;
      panel.append(p);
    }
    if (r.taken.length > 0) {
      const list = document.createElement('ul');
      for (const t of r.taken) {
        const li = document.createElement('li');
        li.textContent = `${t.name} ×${t.qty}`;
        list.append(li);
      }
      panel.append(list);
    }
    const go = document.createElement('button');
    go.type = 'button';
    go.textContent = '▶';
    go.addEventListener('click', () => this.handlers.done());
    panel.append(go);
    this.root.append(panel);
    go.focus();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
  }
}
