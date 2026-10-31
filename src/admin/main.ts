import './admin.css';
import { api, getToken, setToken } from './api.ts';
import { battleView } from './battle_view.ts';
import { button, combo, el, numberInput } from './dom.ts';
import { alertBox, fighterCard, newFighter } from './fighter_card.ts';
import { fieldPanel } from './field_view.ts';
import { lootPanel } from './loot_view.ts';
import { sessionPanel } from './session_view.ts';
import type { BattleResult, Catalog, LabFighter } from './types.ts';

// Battle lab: admin only, served by the Vite dev server, never part of the game build.

type Setup = { seed: number; maxSeconds: number; summonerInParty: boolean; party: LabFighter[]; enemies: LabFighter[] };
const PRESET_KEY = 'runstray.admin.presets';

const root = document.getElementById('app')!;

function loadPresets(): Record<string, Setup> {
  try {
    return JSON.parse(localStorage.getItem(PRESET_KEY) ?? '{}') as Record<string, Setup>;
  } catch {
    return {};
  }
}

function savePresets(p: Record<string, Setup>): void {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(p));
  } catch {
    // storage blocked: presets last for this page only
  }
}

function tokenGate(onReady: () => void): HTMLElement {
  const input = el('input', { type: 'password', placeholder: 'ADMIN_TOKEN from stray-bev1/.env', class: 'token' });
  input.value = getToken();
  const go = () => {
    setToken(input.value.trim());
    onReady();
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  return el('div', { class: 'bar-row' }, input, button('Connect', go, 'primary'));
}

async function start(): Promise<void> {
  const status = el('div', {});
  const gate = tokenGate(() => void connect());
  gate.hidden = true;
  root.replaceChildren(el('header', {}, el('h1', {}, 'Runstray battle lab'), gate), status);

  async function connect(): Promise<void> {
    status.replaceChildren(el('p', { class: 'muted' }, 'Loading catalog…'));
    try {
      const cat = await api<Catalog>('/catalog');
      status.replaceChildren(lab(cat));
    } catch (err) {
      status.replaceChildren(el('p', { class: 'muted' }, 'Is the API running? In stray-bev1: npm run admin. The token comes from stray-bev1/.env through the dev proxy.'));
      gate.hidden = false;
      alertBox(status, err);
    }
  }
  await connect();
}

function lab(cat: Catalog): HTMLElement {
  const setup: Setup = {
    seed: 1, maxSeconds: 300, summonerInParty: false,
    party: [newFighter(cat, 'human')],
    enemies: [{ ...newFighter(cat, `species:${cat.species[0]?.name}`), corrupted: true }],
  };
  const partyCol = el('div', { class: 'col' });
  const enemyCol = el('div', { class: 'col' });
  const result = el('div', {});
  const battleTab = el('div', {});
  const sessionTab = sessionPanel(cat, () => setup.party[0]);
  sessionTab.hidden = true;
  const lootTab = lootPanel(cat);
  lootTab.hidden = true;
  const fieldTab = fieldPanel();
  fieldTab.hidden = true;

  const drawSide = (side: 'party' | 'enemy') => {
    const list = side === 'party' ? setup.party : setup.enemies;
    const col = side === 'party' ? partyCol : enemyCol;
    col.replaceChildren(
      el('h2', {}, side === 'party' ? 'Your side' : 'Enemies'),
      ...list.map((f, i) => fighterCard(cat, f, side, () => { list.splice(i, 1); drawSide(side); })),
      button(side === 'party' ? '+ Add ally' : '+ Add enemy', () => {
        list.push(side === 'party' ? newFighter(cat, 'human') : { ...newFighter(cat, `species:${cat.species[0]?.name}`), corrupted: true });
        drawSide(side);
      }, 'ghost'));
  };

  const run = async () => {
    result.replaceChildren(el('p', { class: 'muted' }, 'Fighting…'));
    try {
      const r = await api<BattleResult>('/battle', setup);
      result.replaceChildren(battleView(cat, r));
    } catch (err) {
      result.replaceChildren();
      alertBox(result, err);
    }
  };

  const presetName = el('input', { placeholder: 'preset name', class: 'label' });
  const presetPicker = el('span', {});
  const drawPresets = () => presetPicker.replaceChildren(combo(
    Object.keys(loadPresets()).map((k) => ({ value: k, label: k })), 'Load preset…', (k) => {
      const p = loadPresets()[k];
      if (!p) return;
      Object.assign(setup, structuredClone(p));
      presetName.value = k;
      drawAll();
    }));
  const drawAll = () => {
    drawSide('party');
    drawSide('enemy');
    controls.replaceChildren(...controlRow());
  };

  const controls = el('div', { class: 'opts sticky' });
  const controlRow = () => {
    const summoner = el('input', { type: 'checkbox' });
    summoner.checked = setup.summonerInParty;
    summoner.addEventListener('change', () => (setup.summonerInParty = summoner.checked));
    return [
      el('label', {}, 'seed ', numberInput(setup.seed, 0, 999999, (v) => (setup.seed = v))),
      button('random', () => { setup.seed = Math.floor(Math.random() * 999999); controls.replaceChildren(...controlRow()); }, 'ghost small'),
      el('label', {}, 'max seconds ', numberInput(setup.maxSeconds, 1, 900, (v) => (setup.maxSeconds = v))),
      el('label', { title: 'Hidden summoner exp bonus' }, summoner, ' summoner in party'),
      button('Run battle', () => void run(), 'primary'),
      presetName,
      button('Save preset', () => {
        const name = presetName.value.trim();
        if (!name) return;
        savePresets({ ...loadPresets(), [name]: structuredClone(setup) });
        drawPresets();
      }, 'ghost'),
      presetPicker,
      button('Reload data', () => void api('/reload', {}).then(() => alertBox(result, new Error('Server data reloaded. Refresh the page for new moves.'))), 'ghost'),
    ];
  };

  battleTab.append(controls, el('div', { class: 'sides' }, partyCol, enemyCol), result);
  drawAll();
  drawPresets();

  const tabs = el('nav', { class: 'tabs' },
    ...([['Battle', battleTab], ['Session pacing', sessionTab], ['Loot', lootTab], ['Field', fieldTab]] as const).map(([label, tab]) =>
      button(label, () => [battleTab, sessionTab, lootTab, fieldTab].forEach((t) => (t.hidden = t !== tab)))));
  return el('main', {}, tabs, battleTab, sessionTab, lootTab, fieldTab);
}

void start();
