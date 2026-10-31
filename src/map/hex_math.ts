// Hex world map drawing helpers: pointy-top axial (q, r) to pixels, corners, and the map palette.
// See .claude/skills/phaser-client/references/iso-hex-math.md. The server sends q, r; nothing hidden is here.

export type Px = { x: number; y: number };

const SQRT3 = Math.sqrt(3);

export function hexToPixel(q: number, r: number, size: number): Px {
  return { x: size * (SQRT3 * q + (SQRT3 / 2) * r), y: size * 1.5 * r };
}

// Pixel (relative to the centre hex) to the axial hex under it, cube-rounded.
export function pixelToHex(x: number, y: number, size: number): { q: number; r: number } {
  const fq = ((SQRT3 / 3) * x - y / 3) / size;
  const fr = ((2 / 3) * y) / size;
  const fs = -fq - fr;
  let q = Math.round(fq), r = Math.round(fr);
  const s = Math.round(fs);
  const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}

// The six corners of a pointy-top hex around its centre.
export function hexCorners(c: Px, size: number): Px[] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return { x: c.x + size * Math.cos(a), y: c.y + size * Math.sin(a) };
  });
}

// Hex radius that fits `rings` rings into a w x h box, with a margin.
export function fitSize(rings: number, w: number, h: number): number {
  return 0.9 * Math.min(w / (SQRT3 * (2 * rings + 1)), h / (3 * rings + 2));
}

export const BIOME_COLORS: Record<string, number> = {
  meadow: 0x7fb069, grove: 0x2f6a3a, desert: 0xe0c98f, snow: 0xeef3f6, volcano: 0x7a2e1e,
  battlefield: 0x9aa063, seashore: 0x6fa8c9,
};
export const FOG_COLOR = 0x1a1d22;
export const UNKNOWN_BIOME = 0x888888;
