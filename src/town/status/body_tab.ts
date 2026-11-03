import { dropTarget, draggable } from './drag.ts';
import { makeFigure } from './figure.ts';
import { el, wear, type Ctx } from './ui.ts';

// Body tab: the figure in the middle with the gear slots as text on both sides, an arrow from each to its body part (rows
// alternate left and right by height, so no arrow crosses the middle), and the body sentences underneath.
// Drag a wearable from the tray (or a worn one from another row) onto a row to wear it there; double tap a worn row to take
// it off, double tap a tray item to wear it when a slot is free. Rings: the worn ones and the first empty ring slot.

const FIGURE_H = 190;
// Where each slot points on the figure (share of its width and height). Layout only.
const ANCHOR: Record<string, [number, number]> = {
  head: [0.5, 0.1], ears: [0.62, 0.14], neck: [0.5, 0.24], body: [0.5, 0.4], main_hand: [0.18, 0.52], off_hand: [0.82, 0.52],
  hands: [0.78, 0.6], pants: [0.5, 0.64], feet: [0.5, 0.93],
};
const RING: [number, number] = [0.3, 0.6];
const NS = 'http://www.w3.org/2000/svg';

export function bodyTab(c: Ctx): HTMLElement {
  const root = el('div');
  const box = el('div', '', 'bodybox');
  const figure = makeFigure(FIGURE_H);
  const left = el('ul', '', 'rows left'), right = el('ul', '', 'rows right');
  const slots = c.s.bag?.slots ?? [];
  const items = c.s.bag?.items ?? [];
  const firstEmptyRing = slots.find((s) => s.slot.startsWith('ring_') && !s.item)?.slot;
  const pointY = (slot: string) => (ANCHOR[slot] ?? RING)[1];
  const shown = slots.filter((s) => !s.slot.startsWith('ring_') || s.item || s.slot === firstEmptyRing).sort((p, q) => pointY(p.slot) - pointY(q.slot));
  const pairs: { row: HTMLElement; slot: string; side: 1 | -1 }[] = [];
  shown.forEach((sl, i) => {
    const row = el('li', '', `row${sl.item ? '' : ' empty'}`);
    row.append(el('b', sl.label ?? sl.slot), el('span', sl.item ?? '—'));
    if (!c.readonly) {
      if (sl.item) {
        draggable(row, `slot:${sl.slot}`);
        row.addEventListener('dblclick', () => c.act.gear({ remove: sl.slot }));
      }
      const held = (data: string) => (data.startsWith('slot:') && data.slice(5) !== sl.slot ? items.find((i) => i.slot === data.slice(5)) : items.find((i) => `bag:${i.ref}` === data && !i.slot));
      dropTarget(row, (d) => held(d)?.fits === sl.accepts, (d) => { const it = held(d); if (it) c.act.gear({ wear: it.ref, slot: sl.slot }); });
    }
    (i % 2 === 0 ? left : right).append(row);
    pairs.push({ row, slot: sl.slot, side: i % 2 === 0 ? 1 : -1 });
  });
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'arrows');
  box.append(left, figure, right, svg);
  root.append(box);

  const tray = el('ul', '', 'tray');
  for (const it of items.filter((i) => i.wearable && !i.slot)) {
    const li = el('li', it.name);
    if (!c.readonly) {
      draggable(li, `bag:${it.ref}`);
      li.addEventListener('dblclick', () => wear(c, it, li));
    }
    tray.append(li);
  }
  if (tray.children.length > 0) root.append(el('div', '', 'rule'), tray);

  const words = el('div', '', 'diegetic'); // how the body feels, in the server's words
  for (const b of c.s.body) if (b.text) words.append(el('p', b.text));
  root.append(el('div', '', 'rule'), words);

  // Arrows run from each row's inner edge to its place on the figure's own side; they need the laid-out boxes.
  requestAnimationFrame(() => {
    const b = box.getBoundingClientRect(), f = figure.getBoundingClientRect();
    for (const { row, slot, side } of pairs) {
      const r = row.getBoundingClientRect();
      const [ax, ay] = ANCHOR[slot] ?? RING;
      const x1 = (side === 1 ? r.right + 2 : r.left - 2) - b.left, y1 = r.top - b.top + r.height / 2;
      const x2 = f.left - b.left + f.width * (side === 1 ? Math.min(ax, 0.42) : Math.max(ax, 0.58)), y2 = f.top - b.top + f.height * ay;
      const line = document.createElementNS(NS, 'line');
      for (const [k, v] of Object.entries({ x1, y1, x2, y2 })) line.setAttribute(k, String(v));
      const dot = document.createElementNS(NS, 'circle');
      for (const [k, v] of Object.entries({ cx: x2, cy: y2, r: 4 })) dot.setAttribute(k, String(v));
      svg.append(line, dot);
    }
  });
  return root;
}
