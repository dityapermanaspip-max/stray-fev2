import type { TalkRequest, TalkView } from '../../../stray-bev1/shared/talk.ts';
import './town.css';

// The talk box (visual novel style): who is speaking and how close they are (a word), what is said, and what the
// player may do now. Every word comes from the server; the marks here are only the copper sign and the close button.
// Gifts: tapping the gift choice lists the bag; tapping an item gives it. Trade and rest open the door's panel.

const COIN = '◎';
const TYPE_MS = 16; // per letter; a tap on the text shows all of it

export class TalkPanel {
  private root = document.createElement('div');
  private timer = 0;
  private said = ''; // kept when an answer has no new words
  private giving = false;

  constructor(private send: (req: TalkRequest) => void) {
    this.root.className = 'talk-panel';
    this.root.hidden = true;
    document.body.append(this.root);
  }

  show(v: TalkView): void {
    const el = (tag: string, text = '', cls = '') => Object.assign(document.createElement(tag), { textContent: text, className: cls });
    this.said = v.text ?? this.said;
    const head = el('header');
    head.append(el('span', v.name.slice(0, 1), 'face'), el('b', v.name), el('i', v.bond ?? ''), this.button('✕', () => this.hide()));
    const words = el('p', '', 'words');
    words.addEventListener('click', () => this.type(words, true));
    this.root.replaceChildren(head, words);
    this.type(words, false);
    const row = el('div', '', 'choices');
    if (this.giving && v.gifts.length > 0) {
      for (const g of v.gifts) row.append(this.button(`${g.name}${g.qty > 1 ? ` ×${g.qty}` : ''}`, () => this.act({ act: 'gift', item: g.item })));
    } else {
      this.giving = false;
      for (const o of v.options) {
        const label = o.price === null ? o.label : `${o.label}  ${COIN} ${o.price}`;
        row.append(this.button(label, () => (o.act === 'gift' ? this.pickGift(v) : this.act({ act: o.act }))));
      }
    }
    this.root.append(row);
    this.root.hidden = false;
  }

  hide(): void {
    window.clearInterval(this.timer);
    this.root.hidden = true;
    this.giving = false;
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  destroy(): void {
    this.hide();
    this.root.remove();
  }

  private act(req: TalkRequest): void {
    this.giving = false;
    this.send(req);
  }

  private pickGift(v: TalkView): void {
    this.giving = true;
    this.show(v);
  }

  // The words appear letter by letter.
  private type(box: HTMLElement, all: boolean): void {
    window.clearInterval(this.timer);
    let n = all ? this.said.length : 0;
    const write = () => {
      box.textContent = this.said.slice(0, n);
      if (n >= this.said.length) window.clearInterval(this.timer);
      n++;
    };
    write();
    if (!all) this.timer = window.setInterval(write, TYPE_MS);
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const b = Object.assign(document.createElement('button'), { type: 'button', textContent: label });
    b.addEventListener('click', onClick);
    return b;
  }
}
