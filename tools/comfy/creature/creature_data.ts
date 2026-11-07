// What the creature script draws: the species looks (same sentences as .claude/skills/creature-prompts/build_prompts.py)
// and the 8 frames the battle scene plays. Wording comes from the prompt builder's sheet cells.

export const TRIGGER = 'chk_creature, (solo:1.4), one single creature, only one animal in the picture';
export const VIEW = 'three-quarter view, body turned to the left, head facing left, seen from slightly above';
export const STYLE = 'hand-painted 2D fantasy game art for an isometric game, clean dark brown outlines, soft shading, lit evenly from directly above with no cast shadow, the whole creature visible and centered on a plain flat grey background';
export const NO_EYES = 'no eyes at all, smooth blank skin, fur, feathers or scales where the eyes would be, no eye sockets, no pupils, no eyelids';
export const NEGATIVE = '(two animals:1.5), (twins:1.5), (pair:1.4), eyes, eye sockets, pupils, text, letters, watermark, signature, ground, floor, shadow on the ground, scenery, background objects, multiple creatures, two creatures, three creatures, group, crowd, pair, sheet, grid, collage, several views, parts, pieces, frame, border, blurry, human';

export type Species = { look: string; attack: string };
export const SPECIES: Record<string, Species> = {
  chicken: { look: 'plump hen, round body, small wings, short beak, scaly yellow legs, white and brown feathers, blank feathered face', attack: 'pecking with its beak' },
  lizard: { look: 'medium lizard on four legs, long tail, small claws, rough scales in green and brown, small teeth, blank scaly face', attack: 'biting with its small teeth' },
  cat: { look: 'lean agile cat, pointed ears, long tail, sharp claws and small fangs, short fur with stripes, blank furry face', attack: 'swiping with its sharp claws' },
  bull: { look: 'one muscular bull, a four-legged hoofed animal with a thick neck, two short curved horns, cloven hooves, a tail with a tuft, brown and cream coat, blank smooth face', attack: 'goring with its curved horns' },
  bear: { look: 'large brown bear standing on four legs, heavy shoulders, thick fur, short round ears, big claws on the paws, powerful teeth showing, blank furry face', attack: 'slashing with its big claws' },
  ostrich: { look: 'an ostrich, a giant flightless bird, (very long thin bare pink neck:1.5), small head, (extremely long strong legs:1.3), big round body of black and white plumes, tiny wings, short flat beak, blank smooth face', attack: 'kicking with its strong legs' },
  rooster: { look: 'one proud rooster, (tall red comb and wattle on the head:1.4), (long curved sweeping tail feathers:1.3), bright red and gold feathers, sharp spurs on the legs, blank feathered face', attack: 'stabbing with its sharp spurs' },
  volcano_chicken: { look: 'a chicken whose body is made of (black volcanic rock plates:1.5) with (glowing orange lava cracks:1.5), dark charcoal body, embers and smoke rising off it, a smoking beak, blank face', attack: 'pecking with its smoking beak' },
};
export const CORRUPTED = 'corrupted by the dark taint, sickly purple-black veins, patches of black ooze on the body, twisted and spiky, unnatural colors, thick wisps of purple smoke coming out of the corrupted body (smoke only, no eyes)';

// idle_1 is the anchor (text only); the rest start from it. denoise: how far a frame may leave the anchor.
export type Frame = { key: string; pose: string; denoise: number };
export const FRAMES: Frame[] = [
  { key: 'idle_1', pose: 'standing idle, weight on both legs', denoise: 1 },
  { key: 'idle_2', pose: 'idle, weight shifted to one side, head tilted', denoise: 0.4 },
  { key: 'attack_1', pose: 'ready to attack, first wind-up, pulling back', denoise: 0.55 },
  { key: 'attack_2', pose: '{attack}, strike at its peak, lunging forward', denoise: 0.6 },
  { key: 'hit_1', pose: 'hit lightly, flinching', denoise: 0.55 },
  { key: 'hit_2', pose: 'staggering, off balance, recoiling from a hard hit', denoise: 0.6 },
  { key: 'wounded', pose: 'badly wounded, hunched and trembling, head low, barely standing', denoise: 0.6 },
  { key: 'dead', pose: 'dead, lying lifeless on its side on the ground', denoise: 0.7 },
];
