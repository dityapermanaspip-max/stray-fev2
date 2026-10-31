import type { AskView, GatherNotice } from '../../../stray-bev1/shared/field.ts';
import './town.css';

// The yes / no question before a door opens or the player leaves the field: the player's thought, the place name
// for a door, and two buttons. The server acts only on yes; walking away closes it.

export class AskPanel {
  private root = document.createElement('div');

  constructor(private answer: (yes: boolean) => void) {
    this.root.className = 'town-panel ask-panel';
    this.root.hidden = true;
    document.body.append(this.root);
  }

  show(v: AskView): void {
    const el = (tag: string, text = '', cls = '') => Object.assign(document.createElement(tag), { textContent: text, className: cls });
    this.root.replaceChildren();
    if (v.place) this.root.append(el('h2', v.place));
    if (v.text) this.root.append(el('p', v.text));
    const row = el('div', '', 'choices');
    row.append(this.button('✓', true), this.button('✕', false));
    this.root.append(row);
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  // The keyboard's answer (Enter yes, Esc no), same as the buttons.
  choose(yes: boolean): void {
    if (!this.visible) return;
    this.hide();
    this.answer(yes);
  }

  destroy(): void {
    this.root.remove();
  }

  private button(label: string, yes: boolean): HTMLButtonElement {
    const b = Object.assign(document.createElement('button'), { textContent: label, type: 'button' });
    b.addEventListener('click', () => {
      this.hide();
      this.answer(yes);
    });
    return b;
  }
}

// After a yes at a resource node: the line the player thinks, then what was found (names and counts from the server).
export const gatheredText = (n: GatherNotice) =>
  [n.text, n.finds.map((f) => (f.qty > 1 ? `${f.name} ×${f.qty}` : f.name)).join(', ')].filter(Boolean).join('  ·  ') || null;
