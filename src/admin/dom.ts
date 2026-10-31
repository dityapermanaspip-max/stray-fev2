// Tiny DOM helpers and the searchable dropdown (native input + datalist, no library).

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

export function numberInput(value: number, min: number, max: number, onChange: (v: number) => void, step = 1): HTMLInputElement {
  const input = el('input', { type: 'number', min: String(min), max: String(max), step: String(step), class: 'num' });
  input.value = String(value);
  input.addEventListener('change', () => {
    const v = Math.min(max, Math.max(min, Number(input.value) || min));
    input.value = String(v);
    onChange(v);
  });
  return input;
}

export type ComboOption = { value: string; label: string };

let comboId = 0;

// Type to search; picks an exact label, or a unique partial match on Enter or blur.
export function combo(options: ComboOption[], placeholder: string, onPick: (value: string) => void, initial = ''): HTMLElement {
  const id = `combo-${++comboId}`;
  const list = el('datalist', { id }, ...options.map((o) => el('option', { value: o.label })));
  const input = el('input', { list: id, placeholder, class: 'combo', autocomplete: 'off' });
  const byLabel = new Map(options.map((o) => [o.label, o.value]));
  input.value = options.find((o) => o.value === initial)?.label ?? '';
  // Exact label, or the only option containing the typed text (so "capoeira" + Enter works).
  const resolve = (text: string): ComboOption | undefined => {
    const exact = options.find((o) => o.label === text);
    if (exact) return exact;
    const q = text.trim().toLowerCase();
    const hits = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : [];
    return hits.length === 1 ? hits[0] : undefined;
  };
  const pick = () => {
    const option = resolve(input.value);
    input.classList.toggle('bad', input.value !== '' && option === undefined);
    if (!option) return;
    input.value = option.label;
    onPick(option.value);
  };
  input.addEventListener('change', pick);
  input.addEventListener('keydown', (e) => e.key === 'Enter' && pick());
  input.addEventListener('input', () => {
    if (byLabel.has(input.value)) pick();
  });
  input.addEventListener('focus', () => input.select());
  return el('span', { class: 'combo-wrap' }, input, list);
}

export function button(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el('button', { type: 'button', class: cls }, label);
  b.addEventListener('click', onClick);
  return b;
}

export const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
