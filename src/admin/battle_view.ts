import { el, seconds } from './dom.ts';
import type { BattleEvent, BattleResult, Catalog, EntityInfo, Frame } from './types.ts';

// Battle result: summary, growth, a filterable timeline, and the hidden state at any point.

export function battleView(cat: Catalog, r: BattleResult): HTMLElement {
  const names = new Map(r.entities.map((e) => [e.id, e.label]));
  const who = (id: unknown) => names.get(String(id)) ?? String(id);
  const moveName = (m: unknown) => cat.moves.find((x) => x.name === m)?.label ?? String(m);
  const fmt = (e: BattleEvent) => describe(e, who, moveName);

  const state = el('div', { class: 'state' });
  const showFrame = (frame: Frame) => state.replaceChildren(stateTable(r.entities, frame));

  const filter = el('input', { placeholder: 'Filter timeline (name, move, word)…', class: 'filter' });
  const hideLines = el('input', { type: 'checkbox' });
  const hideTiers = el('input', { type: 'checkbox' });
  hideTiers.checked = true;
  const list = el('ol', { class: 'timeline' });
  const drawList = () => {
    const q = filter.value.trim().toLowerCase();
    const items: HTMLElement[] = [];
    for (const frame of r.frames) {
      for (const e of frame.events) {
        if (hideLines.checked && e.type === 'line') continue;
        if (hideTiers.checked && e.type === 'tier') continue;
        const text = fmt(e);
        if (q && !text.toLowerCase().includes(q)) continue;
        const li = el('li', { class: `ev ev-${e.type}` }, el('span', { class: 't' }, seconds(frame.t)), text);
        li.addEventListener('click', () => {
          list.querySelector('.sel')?.classList.remove('sel');
          li.classList.add('sel');
          showFrame(frame);
        });
        items.push(li);
      }
    }
    list.replaceChildren(...items);
  };
  filter.addEventListener('input', drawList);
  hideLines.addEventListener('change', drawList);
  hideTiers.addEventListener('change', drawList);
  drawList();
  if (r.frames.length > 0) showFrame(r.frames[r.frames.length - 1]);

  const winner = r.winner === 'party' ? 'Party wins' : r.winner === 'enemy' ? 'Party passed out' : 'Time limit reached';
  const dmg = r.entities.map((e) => `${e.label} ${r.damageBy[e.id] ?? 0}`).join(' · ');
  return el('div', { class: 'result' },
    el('div', { class: 'summary' }, el('strong', {}, winner), ` in ${seconds(r.durationMs)}. Damage dealt: ${dmg}`),
    gearTable(r.entities),
    carcassLine(r),
    ...r.growth.map((g) => growthTable(g, who, moveName)),
    el('div', { class: 'split' },
      el('div', {},
        el('div', { class: 'tl-tools' }, filter,
          el('label', {}, hideLines, ' hide lines'), el('label', {}, hideTiers, ' hide tier changes')),
        list),
      el('div', {}, el('h3', {}, 'Hidden state (admin only)'), el('p', { class: 'muted' }, 'Click a timeline row to see that moment.'), state)));
}

function describe(e: BattleEvent, who: (id: unknown) => string, move: (m: unknown) => string): string {
  switch (e.type) {
    case 'use':
      return `${who(e.actor)} uses ${move(e.move)} on ${(e.targets as string[]).map(who).join(', ')}`;
    case 'damage':
      return `${who(e.target)} takes ${e.amount}${e.outcome === 'crit' ? ' (critical)' : ''} from ${who(e.source)}`;
    case 'miss':
      return `${who(e.actor)} misses ${who(e.target)}`;
    case 'heal':
      return `${who(e.target)} recovers ${e.amount}`;
    case 'line':
      return `${who(e.entity)}: "${e.text}"`;
    case 'tier':
      return `${who(e.entity)} ${e.resource} tier ${e.tier}`;
    case 'status':
      return `${who(e.entity)} ${e.status} ${e.phase}`;
    case 'interrupt':
      return `${who(e.entity)}'s ${move(e.move)} is broken`;
    case 'downed':
      return `${who(e.entity)} goes down`;
    case 'counter':
      return `${who(e.entity)} counters ${who(e.target)} with ${move(e.move)}!`;
    case 'learned':
      return `${who(e.entity)} learns ${move(e.move)}!`;
    case 'end':
      return `Battle over, winner: ${e.winner}`;
    default:
      return JSON.stringify(e);
  }
}

function bar(value: number, max: number): HTMLElement {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return el('span', { class: 'bar', title: `${value} / ${max}` },
    el('span', { class: 'fill', style: `width:${pct}%` }), el('span', { class: 'bar-text' }, `${value}/${max}`));
}

function stateTable(entities: EntityInfo[], frame: Frame): HTMLElement {
  const byId = new Map(frame.state.map((s) => [s.id, s]));
  return el('table', { class: 'grid' },
    el('tr', {}, ...['Who', 'HP', 'Stamina', 'Mana', 'Gauge', 'Phase', 'Effects'].map((h) => el('th', {}, h))),
    ...entities.map((info) => {
      const s = byId.get(info.id)!;
      return el('tr', { class: info.side },
        el('td', {}, info.label),
        el('td', {}, bar(s.hp, info.maxHp)),
        el('td', {}, bar(s.stamina, info.maxStamina)),
        el('td', {}, bar(s.mana, info.maxMana)),
        el('td', {}, String(Math.round(s.atb))),
        el('td', {}, s.phase),
        el('td', {}, s.effects.join(', ') || '—'));
    }));
}

// Hidden gear numbers per fighter at the start of the fight, and what the fight wore down.
function carcassLine(r: BattleResult): HTMLElement {
  const { taken, left } = r.carcasses;
  if (taken.length + left.length === 0) return el('span', {});
  const parts = [...taken.map((t) => `${t.by} carries ${t.item}`), ...(left.length ? [`left on the field: ${left.join(', ')}`] : [])];
  return el('p', { class: 'muted' }, `Carcasses: ${parts.join(' · ')}`);
}

function gearTable(entities: EntityInfo[]): HTMLElement {
  const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
  const list = (m: Record<string, number>, f: (v: number) => string) =>
    Object.entries(m).map(([k, v]) => `${k} ${f(v)}`).join(', ') || '—';
  const weapon = (g: EntityInfo['gear']) => {
    if (!g.weaponType) return 'bare hands';
    const extra = [`acc ×${g.weaponAccuracy}`];
    if (Object.keys(g.vsArmor).length) extra.push(list(g.vsArmor, (v) => `+${pct(v)}`));
    if (g.thrownLeft !== null) extra.push(`${g.thrownLeft} to throw`);
    return `${g.weaponType} +${g.weaponPower} (${extra.join(', ')})`;
  };
  return el('details', { class: 'growth' },
    el('summary', {}, 'Gear (admin only)'),
    el('table', { class: 'grid' },
      el('tr', {}, ...['Who', 'Weapon', 'Punch / kick', 'Armor', 'Coverage', 'Worn effects', 'Load', 'Wear this fight']
        .map((h) => el('th', {}, h))),
      ...entities.map((e) => el('tr', { class: e.side },
        el('td', {}, e.label),
        el('td', {}, weapon(e.gear)),
        el('td', {}, `+${e.gear.punchPower} / +${e.gear.kickPower}`),
        el('td', {}, `${e.gear.defense} (${pct(e.gear.reduction)})`),
        el('td', {}, list(e.gear.coverage, pct)),
        el('td', {}, list(e.gear.statAdd, String)),
        el('td', {}, `${e.gear.weight} / ${e.gear.maxWeight} (tier ${e.gear.loadTier})`),
        el('td', {}, e.wear.map((w) => `${w.item} -${w.lost}`).join(', ') || '—')))));
}

function growthTable(g: BattleResult['growth'][number], who: (id: unknown) => string, move: (m: unknown) => string): HTMLElement {
  const stats = g.stats.filter((s) => s.after !== s.before || s.exp > 0)
    .map((s) => `${s.stat} ${s.before}${s.after !== s.before ? ` → ${s.after}` : ''} (+${s.exp} exp)`);
  return el('details', { class: 'growth', open: '' },
    el('summary', {}, `Growth: ${who(g.id)}`),
    el('p', {}, stats.join(' · ') || 'No stat exp yet.'),
    el('table', { class: 'grid' },
      el('tr', {}, el('th', {}, 'Move'), el('th', {}, 'Level'), el('th', {}, 'Exp toward next')),
      ...g.moves.map((m) => el('tr', { class: m.learned ? 'learned' : '' },
        el('td', {}, `${move(m.move)}${m.learned ? ' (new!)' : ''}`),
        el('td', {}, m.after === m.before ? String(m.after) : `${m.before} → ${m.after}`),
        el('td', {}, String(m.exp))))));
}
