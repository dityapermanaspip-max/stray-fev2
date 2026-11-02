import type { EatRequest, FormationRequest, GearRequest, LoadoutRequest, StatusPanel } from '../../../stray-bev1/shared/town.ts';
import './town.css';

// The status window: body words, the move slots and known moves, and the bag. Text comes from the server.
// In a town's square: pick a known move, then a slot, to place it (✕ empties a slot); ⇡ wears an item, ⇣ takes it off.
// In town, the formation grid (back row left, front row right, facing the foes) picks your battle place.
// Anywhere: 🍴 eats a food item.

export type StatusActions = {
  loadout: (req: LoadoutRequest) => void; gear: (req: GearRequest) => void; eat: (req: EatRequest) => void; formation: (req: FormationRequest) => void;
};

export class StatusWindow {
  private root = document.createElement('div');
  private toggle = document.createElement('button');
  private picked: string | null = null;
  private last: StatusPanel | null = null;

  constructor(private open: () => void, private act: StatusActions) {
    this.toggle.type = 'button';
    this.toggle.className = 'status-toggle';
    this.toggle.textContent = '☰';
    this.toggle.addEventListener('click', () => (this.root.hidden ? this.open() : this.hide()));
    this.root.className = 'town-panel status-panel';
    this.root.hidden = true;
    document.body.append(this.toggle, this.root);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(s: StatusPanel): void {
    this.last = s;
    if (!s.moves.some((m) => m.move === this.picked)) this.picked = null;
    const el = (tag: string, text = '', cls = '') => Object.assign(document.createElement(tag), { textContent: text, className: cls });
    this.root.replaceChildren();
    const head = el('header');
    head.append(el('h2', '☰'), this.button('✕', () => this.hide()));
    this.root.append(head);
    if (s.line) this.root.append(el('p', s.line, 'remark'));
    this.root.append(el('p', s.body.map((b) => b.text).filter(Boolean).join(' · '), 'body'));

    const slots = el('ol', '', 'slots');
    const nameOf = (move: string | null) => s.moves.find((m) => m.move === move)?.name ?? '';
    for (const slot of s.slots) {
      const li = el('li');
      const b = this.button(`${slot.slot}  ${nameOf(slot.move)}`, () => this.place(slot.slot), 'slot');
      b.disabled = !s.canSwap || (!this.picked && !slot.move);
      li.append(b);
      if (slot.move && s.canSwap) li.append(this.button('✕', () => this.act.loadout({ slot: slot.slot, move: null })));
      slots.append(li);
    }
    const moves = el('ul', '', 'moves');
    for (const m of s.moves) {
      const b = this.button(`${m.isNew ? '✦ ' : ''}${m.name}`, () => this.pick(m.move), m.move === this.picked ? 'picked' : '');
      b.disabled = !s.canSwap || m.slot !== null;
      const li = el('li');
      li.append(b);
      moves.append(li);
    }
    this.root.append(slots, moves, this.formation(s));

    if (s.bag) {
      this.root.append(el('p', s.bag.load.text ?? '', 'body'));
      const bag = el('ul', '', 'bag');
      for (const item of s.bag.items) {
        const li = el('li');
        li.append(el('span', `${item.name}${item.qty > 1 ? ` ×${item.qty}` : ''}${item.freshness?.text ? ` · ${item.freshness.text}` : ''}`));
        if (s.canSwap && item.wearable) {
          li.append(item.slot
            ? this.button('⇣', () => this.act.gear({ remove: item.slot! }))
            : this.button('⇡', () => this.act.gear({ wear: item.ref })));
        }
        if (item.edible) li.append(this.button('🍴', () => this.act.eat({ ref: item.ref })));
        bag.append(li);
      }
      this.root.append(bag);
    }
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.picked = null;
  }

  destroy(): void {
    this.root.remove();
    this.toggle.remove();
  }

  private pick(move: string): void {
    this.picked = this.picked === move ? null : move;
    if (this.last) this.show(this.last);
  }

  // A slot click places the picked move there; with nothing picked, it picks up that slot's move to move it.
  private place(slot: number): void {
    const move = this.picked ?? this.last?.slots.find((s) => s.slot === slot)?.move ?? null;
    if (!this.picked) return void (move && this.pick(move));
    this.picked = null;
    if (move) this.act.loadout({ slot, move });
  }

  // Two columns of slot buttons: the back row, then the front row nearer the foes. ● marks where you stand.
  private formation(s: StatusPanel): HTMLElement {
    const { slot: mine, front, back } = s.formation;
    const grid = document.createElement('div');
    grid.className = 'formation';
    const column = (first: number, count: number) => {
      const col = document.createElement('div');
      for (let slot = first; slot < first + count; slot++) {
        const b = this.button(slot === mine ? '●' : '·', () => this.act.formation({ slot }), slot === mine ? 'picked' : '');
        b.disabled = !s.canSwap || slot === mine;
        col.append(b);
      }
      return col;
    };
    grid.append(column(front + 1, back), column(1, front));
    return grid;
  }

  private button(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener('click', onClick);
    return b;
  }
}
