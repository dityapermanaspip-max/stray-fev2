import { api } from './api.ts';
import { button, combo, el, numberInput, type ComboOption } from './dom.ts';
import { gearEditor } from './gear_editor.ts';
import type { Catalog, LabFighter } from './types.ts';

// One editable fighter: template, stats, known moves with levels, which are equipped, and gear.

export function moveOptions(cat: Catalog): ComboOption[] {
  return cat.moves.map((m) => ({
    value: m.name,
    label: `${m.label} · ${m.tree ?? m.category}${m.branch ? ` / ${m.branch}` : ''}`,
  }));
}

function templateOptions(cat: Catalog): ComboOption[] {
  return [
    { value: 'human', label: 'Human (new player)' },
    ...cat.players.map((p) => ({ value: `player:${p.id}`, label: `Saved player: ${p.name}` })),
    ...cat.species.map((s) => ({ value: `species:${s.name}`, label: `Species: ${s.name}` })),
  ];
}

export function newFighter(cat: Catalog, template: string): LabFighter {
  if (template.startsWith('species:')) {
    const s = cat.species.find((x) => `species:${x.name}` === template)!;
    return {
      label: s.name, source: 'species', species: s.name, stats: { ...s.stats }, row: 'front', corrupted: false, count: 1, gear: [],
      moves: s.moves.map((name) => ({ name, level: 1, equipped: true })),
    };
  }
  return {
    label: 'player', source: 'human', species: null, stats: { ...cat.humanStart.stats }, row: 'front', corrupted: false, count: 1, gear: [],
    moves: cat.humanStart.moves.map((name) => ({ name, level: 1, equipped: true })),
  };
}

export function fighterCard(cat: Catalog, f: LabFighter, side: 'party' | 'enemy', onRemove: () => void): HTMLElement {
  const card = el('section', { class: `card ${side}` });
  const render = () => card.replaceChildren(...body());

  const applyTemplate = async (template: string) => {
    const next = template.startsWith('player:')
      ? await api<LabFighter>(`/player?id=${encodeURIComponent(template.slice('player:'.length))}`)
      : newFighter(cat, template);
    Object.assign(f, { ...next, count: f.count, corrupted: f.corrupted, row: f.row });
    render();
  };

  function body(): Node[] {
    const slots = cat.limits.loadoutSlots;
    const equipped = f.moves.filter((m) => m.equipped).length;
    const label = el('input', { class: 'label', value: f.label });
    label.addEventListener('change', () => (f.label = label.value));

    const head = el('div', { class: 'card-head' },
      label,
      combo(templateOptions(cat), 'Load template…', (v) => void applyTemplate(v).catch((e) => alertBox(card, e))),
      button('Remove', onRemove, 'ghost'));

    const row = el('select', {}, el('option', { value: 'front' }, 'Front row'), el('option', { value: 'back' }, 'Back row'));
    row.value = f.row;
    row.addEventListener('change', () => (f.row = row.value as LabFighter['row']));
    const opts = el('div', { class: 'opts' }, row, el('span', { class: 'tag' }, f.source === 'human' ? 'grows' : `species ${f.species}`));
    if (side === 'enemy') {
      const corrupt = el('input', { type: 'checkbox' });
      corrupt.checked = f.corrupted;
      corrupt.addEventListener('change', () => (f.corrupted = corrupt.checked));
      opts.append(el('label', {}, corrupt, ' corrupted'), el('label', {}, 'count ', numberInput(f.count, 1, 8, (v) => (f.count = v))));
    }

    const stats = el('div', { class: 'stats' },
      ...cat.stats.map((s) => el('label', {}, s, numberInput(f.stats[s], 0, 999, (v) => (f.stats[s] = v)))));

    const moves = el('table', { class: 'moves' },
      el('tr', {}, el('th', {}, 'Move'), el('th', {}, 'Lv'), el('th', {}, `Eq ${equipped}/${slots}`), el('th', {}, '')),
      ...f.moves.map((m, i) => moveRow(cat, f, i, slots, render)));

    const add = el('div', { class: 'adders' },
      combo(moveOptions(cat), '+ Add move (type to search)', (v) => {
        if (!f.moves.some((m) => m.name === v)) f.moves.push({ name: v, level: 1, equipped: equipped < slots });
        render();
      }),
      combo(branchOptions(cat), '+ Add whole branch', (v) => {
        for (const m of cat.moves.filter((x) => `${x.tree}/${x.branch}` === v)) {
          if (f.moves.some((k) => k.name === m.name)) continue;
          f.moves.push({ name: m.name, level: 1, equipped: f.moves.filter((k) => k.equipped).length < slots });
        }
        render();
      }));

    return [head, opts, stats, moves, add, el('h4', {}, 'Gear'), gearEditor(cat, f, render)];
  }

  render();
  return card;
}

function moveRow(cat: Catalog, f: LabFighter, i: number, slots: number, render: () => void): HTMLElement {
  const m = f.moves[i];
  const info = cat.moves.find((x) => x.name === m.name);
  const eq = el('input', { type: 'checkbox' });
  eq.checked = m.equipped;
  eq.addEventListener('change', () => {
    if (eq.checked && f.moves.filter((k) => k.equipped).length >= slots) {
      eq.checked = false;
      return;
    }
    m.equipped = eq.checked;
    render();
  });
  const tip = info ? [`needs: ${info.requires.join(', ') || 'nothing'}`, `unlock: ${info.unlock.join(' | ') || 'start / none'}`].join('\n') : '';
  return el('tr', { title: tip },
    el('td', {}, combo(moveOptions(cat), 'move', (v) => { m.name = v; render(); }, m.name)),
    el('td', {}, numberInput(m.level, 1, cat.limits.moveLevelCap, (v) => (m.level = v))),
    el('td', {}, eq),
    el('td', {}, button('×', () => { f.moves.splice(i, 1); render(); }, 'ghost small')));
}

function branchOptions(cat: Catalog): ComboOption[] {
  const seen = new Set<string>();
  for (const m of cat.moves) if (m.tree && m.branch) seen.add(`${m.tree}/${m.branch}`);
  return [...seen].map((v) => ({ value: v, label: v.replace('/', ' / ') }));
}

export function alertBox(where: HTMLElement, err: unknown): void {
  const box = el('div', { class: 'error' }, String((err as Error).message ?? err));
  where.prepend(box);
  setTimeout(() => box.remove(), 6000);
}
