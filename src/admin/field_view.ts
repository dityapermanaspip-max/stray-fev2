import { api } from './api.ts';
import { button, combo, el, numberInput } from './dom.ts';
import { alertBox } from './fighter_card.ts';

// Field preview: a stored dev field, or a template + biome blend + seed, drawn top-down. Lab only.

type FieldTile = { terrain: string; biome: string; height: number; walkable: boolean; slope: number | null };
type FieldGrid = {
  width: number; height: number; tiles: FieldTile[]; spawn: { x: number; y: number };
  exits: { id: string; x: number; y: number }[]; blockedShare: number;
};
type FieldCatalog = {
  templates: { name: string; kind: string; width: number; height: number }[];
  biomes: string[];
  stored: { ref: string; kind: string; label: string }[];
};

// Placeholder colors for the lab only; real art comes with the field scene.
const COLORS: Record<string, string> = {
  grass: '#7fb069', tall_grass: '#5f9a4f', flowers: '#c9a3d9', dirt: '#b08a5a', moss: '#4f7f4a', leaves: '#a5793f',
  bush: '#2f6a3a', rock: '#8a8a86', tree: '#1f4d2b', water: '#4a7fb5', swamp: '#56603c',
};
const ARROWS = ['→', '↓', '←', '↑']; // slope uphill directions: +x, +y, -x, -y
const CELL = 22;

function draw(g: FieldGrid): HTMLCanvasElement {
  const canvas = el('canvas', { width: String(g.width * CELL), height: String(g.height * CELL), class: 'field-canvas' });
  const ctx = canvas.getContext('2d')!;
  g.tiles.forEach((t, i) => {
    const x = (i % g.width) * CELL;
    const y = Math.floor(i / g.width) * CELL;
    ctx.fillStyle = COLORS[t.terrain] ?? '#999';
    ctx.fillRect(x, y, CELL, CELL);
    if (t.height > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.12 * t.height})`; // higher ground is lighter
      ctx.fillRect(x, y, CELL, CELL);
    }
    if (!t.walkable) {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.strokeRect(x + 4.5, y + 4.5, CELL - 9, CELL - 9);
    }
    if (t.slope !== null) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.font = '13px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ARROWS[t.slope], x + CELL / 2, y + CELL / 2);
    }
  });
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const mark = (p: { x: number; y: number }, text: string, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x * CELL + CELL / 2, p.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(text, p.x * CELL + CELL / 2, p.y * CELL + CELL / 2 + 1);
  };
  for (const e of g.exits) mark(e, e.id.replace('d', ''), '#2a78d6');
  mark(g.spawn, '@', '#eb6834');
  return canvas;
}

function legend(g: FieldGrid): HTMLElement {
  const counts = new Map<string, number>();
  for (const t of g.tiles) counts.set(`${t.biome} ${t.terrain}`, (counts.get(`${t.biome} ${t.terrain}`) ?? 0) + 1);
  return el('div', {},
    el('p', {}, `${g.width} × ${g.height} · blocked ${Math.round(g.blockedShare * 100)}% · exits ${g.exits.map((e) => e.id).join(', ')} · @ = spawn, boxed = blocked, lighter = higher, arrow = slope uphill`),
    el('table', { class: 'grid' },
      el('thead', {}, el('tr', {}, el('th', {}, 'biome and terrain'), el('th', {}, 'tiles'))),
      el('tbody', {}, ...[...counts].sort((a, b) => b[1] - a[1]).map(([k, n]) => {
        const swatch = el('span', { class: 'swatch' });
        swatch.style.background = COLORS[k.split(' ')[1]] ?? '#999';
        return el('tr', {}, el('td', {}, swatch, ' ', k), el('td', {}, String(n)));
      }))));
}

export function fieldPanel(): HTMLElement {
  const out = el('div', {});
  const controls = el('div', {});
  const req = { ref: '', template: '', biomeA: '', biomeB: '', from: 0, to: 1, seed: 1 };

  const show = async (body: object) => {
    out.replaceChildren(el('p', { class: 'muted' }, 'Generating…'));
    try {
      const g = await api<FieldGrid>('/field', body);
      out.replaceChildren(el('div', { class: 'field-wrap' }, draw(g)), legend(g));
    } catch (err) {
      out.replaceChildren();
      alertBox(out, err);
    }
  };

  void api<FieldCatalog>('/fields').then((cat) => {
    req.template = cat.templates[0]?.name ?? '';
    req.biomeA = cat.biomes[0] ?? '';
    controls.replaceChildren(
      el('div', { class: 'opts' },
        combo(cat.stored.map((f) => ({ value: f.ref, label: f.label })), 'Stored dev field…', (v) => (req.ref = v)),
        button('Show stored', () => req.ref && void show({ ref: req.ref }), 'primary')),
      el('div', { class: 'opts' },
        combo(cat.templates.map((t) => ({ value: t.name, label: `${t.name} (${t.kind} ${t.width}×${t.height})` })), 'template', (v) => (req.template = v), req.template),
        combo(cat.biomes.map((b) => ({ value: b, label: b })), 'biome A', (v) => (req.biomeA = v), req.biomeA),
        combo([{ value: '', label: '(none)' }, ...cat.biomes.map((b) => ({ value: b, label: b }))], 'biome B', (v) => (req.biomeB = v)),
        el('label', { title: 'Share of biome B at the start and the end of a corridor (0-1)' }, 'B from ', numberInput(req.from, 0, 1, (v) => (req.from = v), 0.05)),
        el('label', {}, 'to ', numberInput(req.to, 0, 1, (v) => (req.to = v), 0.05)),
        el('label', {}, 'seed ', numberInput(req.seed, 0, 999999, (v) => (req.seed = v))),
        button('Generate', () => void show({ ...req, ref: undefined }), 'primary')),
    );
  }).catch((err) => alertBox(controls, err));

  return el('div', {}, el('p', { class: 'muted' }, 'Fields are made from template + biome + seed. A corridor shifts from biome A to B along its length.'), controls, out);
}
