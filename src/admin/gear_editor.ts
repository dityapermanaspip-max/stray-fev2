import { button, combo, el, numberInput, type ComboOption } from './dom.ts';
import type { Catalog, CatalogItem, LabFighter } from './types.ts';

// The gear part of a fighter card: items carried, how many, and which slot each one is equipped in.
// The server applies the real gear rules (two hands, slot fit) and reports a refusal as an error.

function itemOptions(cat: Catalog): ComboOption[] {
  return cat.items.map((i) => ({ value: i.name, label: `${i.label} · ${i.type}${i.material ? ` / ${i.material}` : ''}` }));
}

function describe(i: CatalogItem): string {
  const parts = [`weight ${i.weight}`];
  if (i.defense > 0) parts.push(`defense ${i.defense}`);
  if (i.wield) {
    parts.push(`${i.wield.weaponType} power ${i.wield.power}`, `${i.wield.hands}H`);
    for (const [tag, v] of Object.entries(i.wield.vsArmor)) parts.push(`+${Math.round(v * 100)}% vs ${tag}`);
  }
  if (i.quality !== 'common') parts.push(i.quality);
  return parts.join(' · ');
}

function slotSelect(cat: Catalog, item: CatalogItem | undefined, value: string | null, onChange: (v: string | null) => void): HTMLSelectElement {
  const slots = cat.gearSlots.filter((s) => s.accepts === item?.fits);
  const select = el('select', {}, el('option', { value: '' }, 'carried'), ...slots.map((s) => el('option', { value: s.slot }, s.slot)));
  select.value = value ?? '';
  select.addEventListener('change', () => onChange(select.value || null));
  return select;
}

// First free slot of the right kind, so adding a ring or armor equips it at once.
function freeSlot(cat: Catalog, f: LabFighter, item: CatalogItem): string | null {
  const used = new Set((f.gear ?? []).map((g) => g.slot));
  return cat.gearSlots.find((s) => s.accepts === item.fits && !used.has(s.slot))?.slot ?? null;
}

export function gearEditor(cat: Catalog, f: LabFighter, render: () => void): HTMLElement {
  f.gear ??= [];
  const gear = f.gear;
  const rows = gear.map((g, i) => {
    const item = cat.items.find((x) => x.name === g.item);
    return el('tr', { title: item ? describe(item) : '' },
      el('td', {}, item?.label ?? g.item),
      el('td', {}, numberInput(g.qty, 1, 99, (v) => (g.qty = v))),
      el('td', {}, slotSelect(cat, item, g.slot, (v) => { g.slot = v; render(); })),
      el('td', {}, button('×', () => { gear.splice(i, 1); render(); }, 'ghost small')));
  });

  const add = combo(itemOptions(cat), '+ Add item (type to search)', (v) => {
    const item = cat.items.find((x) => x.name === v);
    if (!item) return;
    gear.push({ item: v, qty: 1, slot: freeSlot(cat, f, item) });
    // A weapon's basic move is learned on equip; add it to the fighter so it can be used.
    const grants = item.wield?.grantsMove;
    if (grants && !f.moves.some((m) => m.name === grants)) {
      f.moves.push({ name: grants, level: 1, equipped: f.moves.filter((m) => m.equipped).length < cat.limits.loadoutSlots });
    }
    render();
  });

  return el('div', { class: 'gear' },
    el('table', { class: 'moves' },
      el('tr', {}, el('th', {}, 'Item'), el('th', {}, 'Qty'), el('th', {}, 'Slot'), el('th', {}, '')),
      ...rows),
    el('div', { class: 'adders' }, add));
}
