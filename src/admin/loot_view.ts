import { api } from './api.ts';
import { button, combo, el, numberInput } from './dom.ts';
import { alertBox } from './fighter_card.ts';
import type { ButcherRequest, ButcherResult, Catalog } from './types.ts';

// Butcher preview: cut the same carcass many times and see how often each drop comes out. Nothing is saved.

const FRESHNESS = ['', 'fresh', 'aging', 'spoiling', 'rotten'];
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

function resultView(r: ButcherResult): HTMLElement {
  const price = (p: number | null) => (p === null ? 'refused' : `${p} copper`);
  const rows = r.drops.map((d) => el('tr', {},
    el('td', {}, d.item), el('td', {}, d.quality), el('td', { class: 'num' }, pct(d.share)),
    el('td', { class: 'num' }, (Math.round(d.avgQty * 10) / 10).toString()), el('td', { class: 'num' }, String(d.value))));
  return el('div', { class: 'result' },
    el('div', { class: 'summary' },
      el('strong', {}, r.carcass), ` · total stats ${r.totalStats} · ${FRESHNESS[r.freshness] ?? r.freshness} · ${r.rolls} cuts · `,
      `only junk ${pct(r.junkShare)} · butcher fee ${r.fee} copper · whole carcass: shop ${price(r.priceShop)}, butcher ${price(r.priceButcher)}`),
    el('table', { class: 'grid' },
      el('thead', {}, el('tr', {}, ...['drop', 'quality', 'came out', 'avg qty', 'value each'].map((h) => el('th', {}, h)))),
      el('tbody', {}, ...rows)));
}

export function lootPanel(cat: Catalog): HTMLElement {
  const req: ButcherRequest = { species: cat.species[0]?.name ?? '', corrupted: true, hours: 0, level: 12, luck: 10, rolls: 1000, seed: 1 };
  const out = el('div', {});
  const corrupted = el('input', { type: 'checkbox' });
  corrupted.checked = req.corrupted;
  corrupted.addEventListener('change', () => (req.corrupted = corrupted.checked));

  const run = async () => {
    out.replaceChildren(el('p', { class: 'muted' }, 'Cutting…'));
    try {
      out.replaceChildren(resultView(await api<ButcherResult>('/butcher', req)));
    } catch (err) {
      out.replaceChildren();
      alertBox(out, err);
    }
  };

  return el('div', {},
    el('p', { class: 'muted' }, 'Level 12 and luck 10 is the town butcher. Hours since the kill sets freshness.'),
    el('div', { class: 'opts' },
      combo(cat.species.map((s) => ({ value: s.name, label: s.name })), 'species', (v) => (req.species = v), req.species),
      el('label', {}, corrupted, ' corrupted'),
      el('label', {}, 'hours ', numberInput(req.hours, 0, 1000, (v) => (req.hours = v))),
      el('label', {}, 'butchery level ', numberInput(req.level, 1, 20, (v) => (req.level = v))),
      el('label', { title: 'Cutter luck: adds flat per mille to every drop. The town butcher has 10.' }, 'luck ', numberInput(req.luck, 0, 999, (v) => (req.luck = v))),
      el('label', {}, 'cuts ', numberInput(req.rolls, 1, 5000, (v) => (req.rolls = v))),
      el('label', {}, 'seed ', numberInput(req.seed, 0, 999999, (v) => (req.seed = v))),
      button('Butcher', () => void run(), 'primary')),
    out);
}
