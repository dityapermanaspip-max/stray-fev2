import { draggable, dropTarget } from './drag.ts';
import { button, el, type Ctx } from './ui.ts';

// Moves tab: the loadout slots and every known move. Drag a move onto a slot (or from slot to slot), or tap a move and then a
// slot. ✕ empties a slot. ✦ marks a move not seen before; the pips are its mastery word tier.

export function movesTab(c: Ctx): HTMLElement {
  const { s, act, state } = c;
  const nameOf = (move: string | null) => s.moves.find((m) => m.move === move)?.name ?? '';
  const place = (slot: number, move: string) => act.loadout({ slot, move });
  const root = el('div');
  const slots = el('ol', '', 'slots');
  for (const slot of s.slots) {
    const li = el('li', '', 'row');
    const b = button(`${slot.slot}  ${nameOf(slot.move)}`, () => {
      if (c.readonly) return;
      const move = state.picked ?? slot.move;
      if (!state.picked) return void (move && ((state.picked = move), c.redraw()));
      state.picked = null;
      place(slot.slot, move!);
    }, 'slot');
    li.append(b);
    if (!c.readonly) {
      if (slot.move) {
        draggable(b, `move:${slot.move}`);
        li.append(button('✕', () => act.loadout({ slot: slot.slot, move: null })));
      }
      dropTarget(li, (d) => d.startsWith('move:'), (d) => place(slot.slot, d.slice(5)));
    }
    slots.append(li);
  }
  const moves = el('ul', '', 'moves');
  for (const m of s.moves) {
    const li = el('li', '', 'row');
    const b = button(`${m.isNew ? '✦ ' : ''}${m.name}`, () => { state.picked = state.picked === m.move ? null : m.move; c.redraw(); }, m.move === state.picked ? 'picked' : '');
    b.append(el('span', '◆'.repeat(m.mastery), 'pips'));
    b.disabled = c.readonly || m.slot !== null;
    if (!c.readonly && m.slot === null) draggable(b, `move:${m.move}`);
    li.append(b);
    moves.append(li);
  }
  root.append(slots, el('div', '', 'rule'), moves);
  return root;
}
