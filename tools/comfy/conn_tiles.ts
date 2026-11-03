// The five generated pieces of a biome connector (the other three are mirrors in the slicer table): edges where the other
// biome lies on the bottom left or top left side, and corners where it lies in the top, bottom or left corner.
// a: the wearing biome's ground, b: the harsher biome's ground (prompt words). Layout guides place b (see guides.ts).
export function connectRows(prefix: string, a: string, b: string): { name: string; tiles: [string, string][] }[] {
  const half = `half ${a} and half ${b}, a soft clear boundary between them`;
  const patch = `${a} with a large patch of ${b}`;
  return [{ name: 'pieces', tiles: [
    [`${prefix}_edge_bl`, half], [`${prefix}_edge_tl`, half], [`${prefix}_corner_t`, patch], [`${prefix}_corner_b`, patch], [`${prefix}_corner_l`, patch],
  ] }];
}
