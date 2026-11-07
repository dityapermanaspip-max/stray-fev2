import type { BattleFighter } from '../../../stray-bev1/shared/battle.ts';
import { creatureAssets, PLAYER_ACTOR } from '../assets/manifest.ts';
import { makeFigure } from '../town/status/figure.ts';
import { hasCreatureArt } from './creature_art.ts';

// The small cards of the battle screen: a face (the head of an actor sheet or the creature's idle picture), a name and,
// for the party, the body-state words. Words only: no bars, no numbers.

const FACE = 44;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => Object.assign(document.createElement(tag), { className, ...(text ? { textContent: text } : {}) });

export function faceOf(f: BattleFighter): HTMLElement {
  const box = el('div', `face ${f.side}`);
  if (f.figure || f.side === 'party') {
    box.append(makeFigure(FACE * 2.4, f.figure?.sheet ?? PLAYER_ACTOR, 'stance_1')); // the head and chest show, the rest is cut off
    if (f.figure?.tint != null) box.style.borderColor = `#${f.figure.tint.toString(16).padStart(6, '0')}`;
  } else if (hasCreatureArt(f)) {
    const a = creatureAssets(f.look!, f.corrupted);
    const img = el('img', a.tint ? 'tinted' : '');
    img.src = a.frames[0].path;
    img.alt = '';
    box.append(img);
  } else {
    box.append(el('i', f.corrupted ? 'dot corrupted' : 'dot'));
  }
  return box;
}

// A turn-order card: face and name.
export function orderCard(f: BattleFighter): HTMLElement {
  const card = el('div', `card ${f.side}${f.you ? ' you' : ''}`);
  card.append(faceOf(f), el('span', 'name', f.name));
  return card;
}

// A party card: face, name and the body words (own fighter: health, stamina, mana; others: health only).
export function partyCard(f: BattleFighter): HTMLElement {
  const card = el('div', `card party${f.you ? ' you' : ''}${f.downed ? ' downed' : ''}`);
  const words = [f.hp, f.stamina, f.mana].flatMap((w) => (w?.text ? [w.text] : []));
  const text = el('div', 'text');
  text.append(el('span', 'name', f.name), el('span', 'words', f.downed ? '…' : words.join(' · ')));
  card.append(faceOf(f), text);
  return card;
}
