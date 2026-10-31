import type { ServiceRequest, ServiceView } from '../../../stray-bev1/shared/town.ts';
import './town.css';

// The panel a town door opens: the service's name, what the player hears, and its actions.
// Inn: rest for a price. Shop: the shelf of finished goods (count, price for one) and what it would pay for each thing in the bag.
// Craftsmen: recipes with what they take, what the player has, and the fee. Money and counts are the only numbers.

const COIN = '◎'; // copper mark next to prices and the purse
const BUY = '⇲'; // the shelf: tap a price to buy one
const SELL = '⇱'; // the bag: tap a price to sell one
const HAGGLE = '⚖'; // try to haggle (one try per visit; shown only when the keeper is open to it)
const GENEROUS = '♡'; // while lit, the next trades pay over or take under the price

export class ServicePanel {
  private root = document.createElement('div');
  private generous = false; // kept while the panel is open

  constructor(private send: (req: ServiceRequest) => void) {
    this.root.className = 'town-panel service-panel';
    this.root.hidden = true;
    document.body.append(this.root);
  }

  show(v: ServiceView): void {
    const el = (tag: string, text = '', cls = '') => Object.assign(document.createElement(tag), { textContent: text, className: cls });
    this.root.replaceChildren();
    const head = el('header');
    head.append(el('h2', v.name), el('span', `${COIN} ${v.purse}`, 'purse'), this.button('✕', () => this.hide()));
    this.root.append(head);
    if (v.text) this.root.append(el('p', v.text, 'remark'));
    if (v.inn) this.root.append(this.button(`☾  ${COIN} ${v.inn.price}`, () => this.send({ action: 'rest' }), 'wide'));

    const list = (mark: string, rows: { label: string; price: number; can: boolean; req: ServiceRequest }[]) => {
      if (rows.length === 0) return;
      const ul = el('ul', '', 'trade');
      for (const r of rows) {
        const li = el('li');
        const b = this.button(`${COIN} ${r.price}`, () => this.send(r.req));
        b.disabled = !r.can;
        li.append(el('span', r.label), b);
        ul.append(li);
      }
      this.root.append(el('h3', mark), ul);
    };
    const count = (qty: number) => (qty > 1 ? ` ×${qty}` : '');
    if (v.shop) {
      const g = this.generous;
      const tools = el('div', '', 'shop-tools');
      if (v.shop.haggle) tools.append(this.button(HAGGLE, () => this.send({ action: 'haggle' })));
      tools.append(this.button(GENEROUS, () => { this.generous = !this.generous; this.show(v); }, g ? 'lit' : ''));
      this.root.append(tools);
      list(BUY, v.shop.wares.map((w) => ({ label: `${w.name}${count(w.qty)}`, price: w.price, can: w.price <= v.purse, req: { action: 'buy', key: w.key, generous: g } })));
      list(SELL, v.shop.offers.map((o) => ({ label: `${o.name}${count(o.qty)}`, price: o.price, can: o.price > 0, req: { action: 'sell', ref: o.ref, generous: g } })));
    }
    if (v.craft) {
      for (const r of v.craft.recipes) {
        const box = el('div', '', 'recipe');
        const needs = r.inputs.map((x) => `${x.name} ${x.have}/${x.qty}`).join(' · ');
        const b = this.button(`${COIN} ${r.fee}`, () => this.send({ action: 'craft', name: r.name }));
        b.disabled = r.inputs.some((x) => x.have < x.qty) || r.fee > v.purse;
        box.append(el('span', r.outputs.map((x) => `${x.name}${count(x.qty)}`).join(' · ')), el('small', `← ${needs}`), b);
        this.root.append(box);
      }
    }
    this.root.hidden = false;
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  hide(): void {
    this.root.hidden = true;
    this.generous = false;
  }

  destroy(): void {
    this.root.remove();
  }

  private button(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener('click', onClick);
    return b;
  }
}
