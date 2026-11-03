// Pointer drag and drop that works with a mouse (a finger drags too where the browser lets it; double tap is the sure way).
// A draggable carries a string; a drop target says what it takes and what to do with it. The target under the pointer lights up.

type Drop = { accepts: (data: string) => boolean; drop: (data: string) => void };
const targets = new WeakMap<Element, Drop>();
const MOVE_PX = 8;

export function dropTarget(el: HTMLElement, accepts: (data: string) => boolean, drop: (data: string) => void): void {
  targets.set(el, { accepts, drop });
  el.classList.add('drop');
}

const under = (x: number, y: number): { el: Element; drop: Drop } | null => {
  for (let el = document.elementFromPoint(x, y); el; el = el.parentElement) {
    const drop = targets.get(el);
    if (drop) return { el, drop };
  }
  return null;
};

export function draggable(el: HTMLElement, data: string): void {
  el.classList.add('drag');
  el.addEventListener('pointerdown', (down) => {
    if (down.button !== 0) return;
    let ghost: HTMLElement | null = null;
    let hot: Element | null = null;
    const light = (e: PointerEvent) => {
      const hit = under(e.clientX, e.clientY);
      const next = hit && hit.drop.accepts(data) ? hit.el : null;
      if (next !== hot) { hot?.classList.remove('hot'); next?.classList.add('hot'); hot = next; }
    };
    const move = (e: PointerEvent) => {
      if (!ghost && Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) < MOVE_PX) return;
      if (!ghost) {
        ghost = Object.assign(document.createElement('div'), { className: 'drag-ghost', textContent: el.textContent ?? '' });
        document.body.append(ghost);
        el.classList.add('lifted');
      }
      ghost.style.transform = `translate(${e.clientX + 10}px, ${e.clientY + 10}px)`;
      light(e);
    };
    const end = (e: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (!ghost) return;
      ghost.remove();
      el.classList.remove('lifted');
      hot?.classList.remove('hot');
      const hit = e.type === 'pointerup' ? under(e.clientX, e.clientY) : null;
      if (hit?.drop.accepts(data)) hit.drop.drop(data);
      const swallow = (c: Event) => c.stopPropagation(); // a drag is not a click
      window.addEventListener('click', swallow, { capture: true });
      window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  });
}
