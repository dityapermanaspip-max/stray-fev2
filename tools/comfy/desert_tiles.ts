// The 64 flat walkable tiles of the desert test set, 8 per row, in atlas order. [key, what it looks like].
// Same shape as the meadow set: families, then edges, corners and paths made from layout guides (guides.ts).
export const ROWS: { name: string; tiles: [string, string][] }[] = [
  { name: 'sand', tiles: [
    ['sand_a', 'plain golden desert sand'], ['sand_b', 'plain golden desert sand, slightly darker'], ['sand_c', 'plain golden desert sand, slightly lighter'],
    ['sand_d', 'golden desert sand with soft wind ripples'], ['sand_fine', 'smooth fine pale sand'], ['sand_ripples', 'sand with deep wind-carved ripples'],
    ['sand_red', 'reddish orange desert sand'], ['sand_pale', 'pale cream coloured sand'],
  ] },
  { name: 'detail', tiles: [
    ['sand_pebbles', 'golden sand with a few small pebbles'], ['sand_rocks', 'golden sand with a few small flat rocks'], ['sand_prints', 'golden sand with animal footprints'],
    ['sand_bones', 'golden sand with a few small bleached animal bones'], ['sand_scrub', 'golden sand with tiny dry scrub tufts'], ['sand_streaks', 'golden sand with dark wind-blown streaks'],
    ['sand_dark', 'golden sand with a dark damp patch'], ['sand_shells', 'golden sand with small fossil shells'],
  ] },
  { name: 'hardpan', tiles: [
    ['cracked_a', 'dry cracked clay earth'], ['cracked_b', 'dry cracked clay earth, paler'], ['salt_crust', 'white salt crust, cracked'],
    ['hardpan_red', 'hard packed red earth'], ['hardpan_pebbles', 'hard packed earth with small pebbles'], ['gravel', 'grey gravel ground'],
    ['clay_orange', 'smooth orange clay'], ['salt_flat', 'flat white salt crust'],
  ] },
  { name: 'rock', tiles: [
    ['slab_sandstone', 'flat sandstone slab ground'], ['slab_cracked', 'cracked flat rock plates'], ['rocky_ground', 'rocky ground with small stones'],
    ['rock_red', 'red rock ground'], ['basalt_gravel', 'dark basalt gravel'], ['sandstone_stripes', 'layered striped sandstone floor'],
    ['cobbles_scattered', 'sand with scattered cobblestones'], ['ruin_paving', 'ancient flagstone paving half buried in sand'],
  ] },
  { name: 'sand_clay_edge', tiles: [
    ['se_edge_bl', 'half golden sand and half red hard clay, a clear boundary between sand and clay'], ['se_edge_br', 'half golden sand and half red hard clay, a clear boundary between sand and clay'],
    ['se_edge_tl', 'half golden sand and half red hard clay, a clear boundary between sand and clay'], ['se_edge_tr', 'half golden sand and half red hard clay, a clear boundary between sand and clay'],
    ['se_corner_b', 'golden sand with a large patch of red hard clay'], ['se_corner_t', 'golden sand with a large patch of red hard clay'],
    ['se_corner_l', 'golden sand with a large patch of red hard clay'], ['se_corner_r', 'golden sand with a large patch of red hard clay'],
  ] },
  { name: 'sand_track', tiles: [
    ['tp_straight_x', 'a darker packed brown track running from the top left to the bottom right across golden sand'],
    ['tp_straight_y', 'a darker packed brown track running from the top right to the bottom left across golden sand'],
    ['tp_corner_t', 'a darker packed brown track turning, connecting the top left and top right edges, golden sand around'],
    ['tp_corner_r', 'a darker packed brown track turning, connecting the top right and bottom right edges, golden sand around'],
    ['tp_corner_b', 'a darker packed brown track turning, connecting the bottom right and bottom left edges, golden sand around'],
    ['tp_corner_l', 'a darker packed brown track turning, connecting the bottom left and top left edges, golden sand around'],
    ['tp_cross', 'a darker packed brown track crossroads, four ways, golden sand in the corners'], ['tp_end', 'a darker packed brown track that ends in the middle of the tile, golden sand around'],
  ] },
  { name: 'flagstone_path', tiles: [
    ['fp_straight_x', 'a grey flagstone path running from the top left to the bottom right across golden sand'],
    ['fp_straight_y', 'a grey flagstone path running from the top right to the bottom left across golden sand'],
    ['fp_corner_t', 'a grey flagstone path turning, connecting the top left and top right edges, golden sand around'],
    ['fp_corner_r', 'a grey flagstone path turning, connecting the top right and bottom right edges, golden sand around'],
    ['fp_corner_b', 'a grey flagstone path turning, connecting the bottom right and bottom left edges, golden sand around'],
    ['fp_corner_l', 'a grey flagstone path turning, connecting the bottom left and top left edges, golden sand around'],
    ['fp_cross', 'a grey flagstone crossroads, four ways, golden sand in the corners'], ['fp_end', 'a grey flagstone path that ends in the middle of the tile, golden sand around'],
  ] },
  { name: 'oasis', tiles: [
    ['oasis_grass', 'sparse green grass on damp sand'], ['damp_sand', 'dark damp sand near water'], ['dune_crest', 'sand with a sharp dune crest line'],
    ['dry_grass', 'sand with dry yellow grass tufts'], ['palm_litter', 'sand with fallen dry palm fronds'], ['sand_clay_mix', 'sand mixed with cracked clay'],
    ['wet_ripples', 'wet sand with small ripples'], ['stones_stepping', 'golden sand with flat stepping stones in a line'],
  ] },
];
