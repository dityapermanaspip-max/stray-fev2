import { button, el, type Ctx } from './ui.ts';

// Party tab: where you stand in battle (the front row nearer the foes, the back row behind), and who is with you. A companion
// whose bond is deep enough opens their own window; the others stay shut. The words are the server's.

export function partyTab(c: Ctx): HTMLElement {
  const root = el('div');
  const { slot: mine, front, back } = c.s.formation;
  const grid = el('div', '', 'formation');
  const column = (first: number, count: number) => {
    const col = el('div');
    for (let slot = first; slot < first + count; slot++) {
      const b = button(slot === mine ? '●' : '·', () => c.act.formation({ slot }), slot === mine ? 'picked' : '');
      b.disabled = c.readonly || slot === mine;
      col.append(b);
    }
    return col;
  };
  grid.append(column(front + 1, back), column(1, front));
  root.append(grid, el('div', '', 'rule'));
  const list = el('ul', '', 'members');
  for (const m of c.party?.members ?? []) {
    const li = el('li', '', 'row');
    const b = button(m.name, () => c.act.companion({ id: m.id }));
    b.disabled = !m.open;
    li.append(b, el('i', m.bond ?? ''));
    list.append(li);
  }
  root.append(list);
  return root;
}
