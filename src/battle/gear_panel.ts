import type { BattleGearView } from '../../../stray-bev1/shared/battle.ts';

// The battle menu's gear panel: what the player holds and what could be held (weapons, shields, throwables). Clicking an
// item holds it (or takes it off when it is already in a hand); the server spends the turn and answers a fresh list.

export type GearHandlers = { wear: (ref: string) => void; remove: (slot: string) => void };

export class GearPanel {
  private box = document.createElement('div');
  visible = false;

  constructor(private parent: HTMLElement, private handlers: GearHandlers) {
    this.box.className = 'battle-gear';
    this.box.hidden = true;
    parent.append(this.box);
  }

  show(view: BattleGearView): void {
    this.box.replaceChildren();
    const held = document.createElement('p');
    held.className = 'held';
    held.textContent = view.hands.length > 0 ? view.hands.map((h) => h.name).join(' · ') : '—';
    this.box.append(held);
    for (const it of view.items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = it.slot ? 'on' : '';
      b.textContent = it.qty > 1 ? `${it.name} ×${it.qty}` : it.name;
      b.addEventListener('click', () => {
        if (it.slot) this.handlers.remove(it.slot);
        else this.handlers.wear(it.ref);
        this.hide();
      });
      this.box.append(b);
    }
    this.box.hidden = false;
    this.visible = true;
  }

  hide(): void {
    this.box.hidden = true;
    this.visible = false;
  }

  toggleWith(request: () => void): void {
    if (this.visible) this.hide();
    else request();
  }
}
