import { api } from './api.ts';
import { button, el, numberInput } from './dom.ts';
import { alertBox } from './fighter_card.ts';
import type { Catalog, LabFighter, SessionResult } from './types.ts';

// Pacing sim: chained fights with sitting. Two small single-series charts, never a dual axis.

const SVG = 'http://www.w3.org/2000/svg';
const W = 640;
const H = 200;
const PAD = { l: 44, r: 12, t: 26, b: 32 };

function svg(tag: string, attrs: Record<string, string | number>, ...children: Node[]): SVGElement {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  node.append(...children);
  return node;
}

function titled(node: SVGElement, text: string): SVGElement {
  node.append(svg('title', {}, document.createTextNode(text)));
  return node;
}

function axes(xMax: number, yMax: number, xLabel: string, yLabel: string): { g: SVGElement; x: (v: number) => number; y: (v: number) => number } {
  const x = (v: number) => PAD.l + (v / Math.max(xMax, 1e-9)) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / Math.max(yMax, 1e-9)) * (H - PAD.t - PAD.b);
  const g = svg('g', { class: 'axes' });
  for (let i = 0; i <= 4; i++) {
    const yv = (yMax / 4) * i;
    g.append(svg('line', { x1: PAD.l, x2: W - PAD.r, y1: y(yv), y2: y(yv), class: 'grid-line' }));
    g.append(svg('text', { x: PAD.l - 6, y: y(yv) + 4, 'text-anchor': 'end' }, document.createTextNode(String(Math.round(yv * 10) / 10))));
  }
  for (let i = 0; i <= 4; i++) {
    const xv = (xMax / 4) * i;
    g.append(svg('text', { x: x(xv), y: H - PAD.b + 16, 'text-anchor': 'middle' }, document.createTextNode(String(Math.round(xv * 10) / 10))));
  }
  g.append(svg('text', { x: W - PAD.r, y: H - 4, 'text-anchor': 'end', class: 'axis-label' }, document.createTextNode(xLabel)));
  g.append(svg('text', { x: 4, y: 12, class: 'axis-label' }, document.createTextNode(yLabel)));
  return { g, x, y };
}

function movesChart(r: SessionResult): HTMLElement {
  const pts = r.series.map((p) => ({ x: p.atMs / 60000, y: p.movesKnown }));
  const xMax = Math.max(...pts.map((p) => p.x), 1);
  const yMax = Math.max(...pts.map((p) => p.y), 1) + 1;
  const { g, x, y } = axes(xMax, yMax, 'minutes played', 'moves known');
  let d = `M ${x(0)} ${y(pts[0]?.y ?? 0)}`;
  for (const p of pts) d += ` H ${x(p.x)} V ${y(p.y)}`;
  const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' }, g, svg('path', { d, class: 'series-line' }));
  for (const m of r.milestones) {
    const at = m.atMs / 60000;
    const known = [...r.series].reverse().find((p) => p.atMs <= m.atMs + 1)?.movesKnown ?? r.series[0]?.movesKnown ?? 0;
    chart.append(titled(svg('circle', { cx: x(at), cy: y(known), r: 5, class: 'series-dot' }), `${m.label} · fight ${m.fight} · ${at.toFixed(1)} min`));
  }
  return el('figure', {}, el('figcaption', {}, 'Moves known over time (dots = milestones, hover for detail)'), chart);
}

function sittingChart(r: SessionResult): HTMLElement {
  const n = r.series.length;
  const yMax = Math.max(...r.series.map((p) => p.sitMs / 1000), 1);
  const { g, x, y } = axes(n, yMax, 'fight number', 'seconds sitting');
  const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' }, g);
  const bw = Math.max(1, (W - PAD.l - PAD.r) / n - 2);
  for (const p of r.series) {
    const top = y(p.sitMs / 1000);
    const label = `fight ${p.fight}: ${(p.sitMs / 1000).toFixed(1)}s sitting, ${p.outcome.replace('_', ' ')}`;
    chart.append(titled(svg('rect', { x: x(p.fight - 1) + 1, y: top, width: bw, height: H - PAD.b - top, rx: 2, class: 'series-bar' }), label));
  }
  return el('figure', {}, el('figcaption', {}, 'Sitting time after each fight (0 = potion/town stop or passed out)'), chart);
}

function summary(r: SessionResult): HTMLElement {
  const total = r.fightMs + r.sitMs;
  const min = (ms: number) => `${(ms / 60000).toFixed(1)} min`;
  return el('div', { class: 'result' },
    el('div', { class: 'summary' },
      el('strong', {}, `${r.wins} won, ${r.passedOut} passed out, ${r.lowHpStops} low-HP stops. `),
      `${min(total)} total: fighting ${min(r.fightMs)}, sitting ${min(r.sitMs)} (${((r.sitMs / Math.max(total, 1)) * 100).toFixed(1)}% waiting).`),
    movesChart(r),
    sittingChart(r),
    el('details', {}, el('summary', {}, 'Milestones table'),
      el('table', { class: 'grid' }, el('tr', {}, el('th', {}, 'Milestone'), el('th', {}, 'Fight'), el('th', {}, 'Minute')),
        ...r.milestones.map((m) => el('tr', {}, el('td', {}, m.label), el('td', {}, String(m.fight)), el('td', {}, (m.atMs / 60000).toFixed(1)))))),
    el('p', {}, `End: ${r.moves.map((m) => `${m.name} L${m.level}`).join(', ')}`),
    el('p', {}, `Stats: ${Object.entries(r.stats).map(([s, v]) => `${s} ${v}`).join(', ')}`));
}

export function sessionPanel(cat: Catalog, firstPartyFighter: () => LabFighter | undefined): HTMLElement {
  const opts = { fights: 40, corruptedShare: 0.5, lowHpTier: 2, seed: 1, fromParty: false };
  const enemies = new Set(cat.species.map((s) => s.name));
  const out = el('div', {});
  const panel = el('div', { class: 'panel' });

  const run = async () => {
    const f = firstPartyFighter();
    const start = opts.fromParty && f ? { stats: f.stats, moves: f.moves.filter((m) => m.equipped).map((m) => ({ name: m.name, level: m.level })) } : null;
    out.replaceChildren(el('p', { class: 'muted' }, 'Running…'));
    try {
      const r = await api<SessionResult>('/session', { ...opts, enemies: [...enemies], start });
      out.replaceChildren(summary(r));
    } catch (err) {
      out.replaceChildren();
      alertBox(panel, err);
    }
  };

  const fromParty = el('input', { type: 'checkbox' });
  fromParty.addEventListener('change', () => (opts.fromParty = fromParty.checked));
  panel.append(
    el('div', { class: 'opts' },
      el('label', {}, 'fights ', numberInput(opts.fights, 1, 500, (v) => (opts.fights = v))),
      el('label', {}, 'corrupted share ', numberInput(opts.corruptedShare, 0, 1, (v) => (opts.corruptedShare = v), 0.1)),
      el('label', {}, 'stop at HP tier ', numberInput(opts.lowHpTier, 1, 5, (v) => (opts.lowHpTier = v))),
      el('label', {}, 'seed ', numberInput(opts.seed, 0, 999999, (v) => (opts.seed = v))),
      el('label', {}, fromParty, ' start from party fighter 1 (equipped moves)')),
    el('div', { class: 'opts' }, 'Enemies: ', ...cat.species.map((s) => {
      const box = el('input', { type: 'checkbox' });
      box.checked = true;
      box.addEventListener('change', () => (box.checked ? enemies.add(s.name) : enemies.delete(s.name)));
      return el('label', {}, box, ` ${s.name}`);
    })),
    button('Run session', () => void run(), 'primary'),
    out);
  return panel;
}
