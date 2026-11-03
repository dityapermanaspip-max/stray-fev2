import type { CompanionRequest, DropRequest, EatRequest, FormationRequest, GearRequest, LoadoutRequest, PartyView, StatusPanel } from '../../../../stray-bev1/shared/town.ts';

// What the status tabs share: the requests they can make, the state they draw from, two element helpers.

export type StatusActions = {
  loadout: (req: LoadoutRequest) => void; gear: (req: GearRequest) => void; eat: (req: EatRequest) => void; formation: (req: FormationRequest) => void;
  drop: (req: DropRequest) => void; party: () => void; companion: (req: CompanionRequest) => void;
};

export type Ctx = {
  s: StatusPanel; act: StatusActions; party: PartyView | null;
  state: { picked: string | null }; // the move picked for placing (tap a move, then a slot)
  redraw: () => void;
  readonly: boolean; // a companion's window: look, do not touch
};

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] =>
  Object.assign(document.createElement(tag), { textContent: text, className: cls });

export function button(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el('button', label, cls);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

type Bag = NonNullable<StatusPanel['bag']>;
export type BagItem = Bag['items'][number];

// Wear an item if a slot that takes it is free; else the item shakes (a free slot is the player's to make).
export function wear(c: Ctx, item: BagItem, from: HTMLElement): void {
  const free = c.s.bag?.slots.some((sl) => sl.accepts === item.fits && !sl.item);
  if (free) c.act.gear({ wear: item.ref });
  else {
    from.classList.remove('shake');
    void from.offsetWidth; // restart the animation
    from.classList.add('shake');
  }
}
