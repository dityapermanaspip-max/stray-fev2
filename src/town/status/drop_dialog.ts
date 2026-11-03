import { button, el } from './ui.ts';

// "Throw away how many?": a slider from 1 to what is held. ✓ throws that many away, ✕ keeps them all.
export function dropDialog(host: HTMLElement, name: string, held: number, onDrop: (qty: number) => void): void {
  const slider = Object.assign(document.createElement('input'), { type: 'range', min: '1', max: String(held), value: String(held), step: '1' });
  const count = el('div', String(held), 'count');
  slider.addEventListener('input', () => (count.textContent = slider.value));
  const close = () => shade.remove();
  const box = el('div');
  box.append(el('div', name), count, slider, el('div', '', 'buttons'));
  box.lastElementChild!.append(button('✓', () => { close(); onDrop(Number(slider.value)); }), button('✕', close));
  const shade = el('div', '', 'dialog');
  shade.append(box);
  shade.addEventListener('click', (e) => e.target === shade && close());
  host.append(shade);
}
