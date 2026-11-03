import type { PartyView, StatusPanel } from '../../../stray-bev1/shared/town.ts';
import './town.css';
import './status/status.css';
import { bagTab } from './status/bag_tab.ts';
import { bodyTab } from './status/body_tab.ts';
import { movesTab } from './status/moves_tab.ts';
import { partyTab } from './status/party_tab.ts';
import { button, el, type Ctx, type StatusActions } from './status/ui.ts';

// The status window, a medieval frame with four tabs: body (figure, gear), moves (loadout), bag, party (battle place,
// companions). A companion's window (read only) opens from the party tab and has a way back. Text comes from the server.
// Requests are made by the scene (StatusActions); every answer comes back through show() or showParty().

export type { StatusActions } from './status/ui.ts';

type Tab = 'body' | 'moves' | 'bag' | 'party';
const TABS: { tab: Tab; mark: string }[] = [{ tab: 'body', mark: '☺' }, { tab: 'moves', mark: '⚔' }, { tab: 'bag', mark: '🎒' }, { tab: 'party', mark: '⚑' }];

export class StatusWindow {
  private root = document.createElement('div');
  private toggle = document.createElement('button');
  private act: StatusActions;
  private open: () => void;
  private own: StatusPanel | null = null;
  private other: StatusPanel | null = null; // a companion's window, while one is open
  private party: PartyView | null = null;
  private tab: Tab = 'body';
  private state: Ctx['state'] = { picked: null };

  constructor(open: () => void, act: StatusActions) {
    [this.open, this.act] = [open, act];
    this.toggle.type = 'button';
    this.toggle.className = 'status-toggle';
    this.toggle.textContent = '☰';
    this.toggle.addEventListener('click', () => (this.root.hidden ? this.open() : this.hide()));
    this.root.className = 'town-panel status-panel';
    this.root.hidden = true;
    document.body.append(this.toggle, this.root);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(s: StatusPanel): void {
    if (s.who) {
      if (!this.other) this.tab = 'body';
      this.other = s;
    } else {
      this.own = s;
      this.other = null;
    }
    if (!s.moves.some((m) => m.move === this.state.picked)) this.state.picked = null;
    this.root.hidden = false;
    this.draw();
  }

  showParty(v: PartyView): void {
    this.party = v;
    if (this.tab === 'party' && !this.root.hidden) this.draw();
  }

  hide(): void {
    this.root.hidden = true;
    this.state.picked = null;
  }

  destroy(): void {
    this.root.remove();
    this.toggle.remove();
  }

  private go(tab: Tab): void {
    this.tab = tab;
    if (tab === 'party') {
      this.other = null;
      this.act.party();
    }
    this.draw();
  }

  private draw(): void {
    const own = this.own;
    if (!own) return;
    const s = this.tab === 'party' ? own : this.other ?? own;
    const ctx: Ctx = { s, act: this.act, party: this.party, state: this.state, redraw: () => this.draw(), readonly: !!s.who };
    const head = el('header');
    if (s.who) head.append(button('←', () => this.go('party')));
    head.append(el('h2', s.who ?? '☰'), button('✕', () => this.hide()));
    const tabs = el('nav', '', 'tabs');
    for (const t of TABS.filter((x) => !s.who || x.tab !== 'party')) tabs.append(button(t.mark, () => this.go(t.tab), t.tab === this.tab ? 'on' : ''));
    const inner = el('div', '', 'inner');
    if (s.line) inner.append(el('p', s.line, 'remark'));
    inner.append(this.tab === 'body' ? bodyTab(ctx) : this.tab === 'moves' ? movesTab(ctx) : this.tab === 'bag' ? bagTab(ctx, this.root) : partyTab(ctx));
    const corners = ['tl', 'tr', 'bl', 'br'].map((c) => el('i', '', `corner ${c}`));
    this.root.replaceChildren(...corners, head, tabs, inner);
  }
}
