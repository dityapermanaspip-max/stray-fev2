import { dropDialog } from './drop_dialog.ts';
import { button, el, wear, type Ctx } from './ui.ts';

// Bag tab: the load word and what is carried. Worn things first. Double tap an item to wear it (when a slot is free) or a worn
// one to take it off; 🍴 eats; ⤓ throws away, asking how many with a slider (worn things and keys stay).

export function bagTab(c: Ctx, host: HTMLElement): HTMLElement {
  const root = el('div');
  const bag = c.s.bag;
  if (!bag) return root;
  root.append(el('p', bag.load.text ?? '', 'body'));
  const list = el('ul', '', 'items');
  for (const item of bag.items) {
    const li = el('li', '', item.slot ? 'worn' : '');
    li.append(el('span', `${item.slot ? '◈ ' : ''}${item.name}${item.qty > 1 ? ` ×${item.qty}` : ''}${item.freshness?.text ? ` · ${item.freshness.text}` : ''}`));
    if (!c.readonly) {
      if (item.wearable) {
        li.addEventListener('dblclick', () => (item.slot ? c.act.gear({ remove: item.slot }) : wear(c, item, li)));
        li.append(item.slot ? button('⇣', () => c.act.gear({ remove: item.slot! })) : button('⇡', () => wear(c, item, li)));
      }
      if (item.edible) li.append(button('🍴', () => c.act.eat({ ref: item.ref })));
      if (item.droppable && !item.slot) li.append(button('⤓', () => dropDialog(host, item.name, item.qty, (qty) => c.act.drop({ ref: item.ref, qty }))));
    }
    list.append(li);
  }
  root.append(list);
  return root;
}
