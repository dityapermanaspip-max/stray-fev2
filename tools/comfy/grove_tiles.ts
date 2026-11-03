// The 64 flat walkable tiles of the grove test set (a dark woodland: leaf litter, moss, soil, mud, old stone), 8 per row.
// [key, what it looks like]. Edges, corners and paths come from layout guides (guides.ts); prefixes: gs (moss and soil),
// ft (forest trail), mp (mossy stone path), bw (plank boardwalk).
export const ROWS: { name: string; tiles: [string, string][] }[] = [
  { name: 'floor', tiles: [
    ['leaves_a', 'dark forest floor covered in brown fallen leaves'], ['leaves_b', 'dark forest floor with fallen leaves, slightly darker'], ['leaves_c', 'forest floor with golden fallen leaves'],
    ['leaves_d', 'forest floor with red and orange autumn leaves'], ['moss_a', 'soft green moss ground'], ['moss_b', 'thick deep green moss ground'],
    ['needles', 'forest floor covered in brown pine needles'], ['forest_grass', 'short dark green shaded grass'],
  ] },
  { name: 'detail', tiles: [
    ['roots_flat', 'dark soil with flat tree roots crossing it'], ['fern_ground', 'forest floor with low green fern fronds'], ['mushrooms_small', 'mossy ground with a few tiny mushrooms'],
    ['acorns', 'leaf litter with fallen acorns and twigs'], ['stones_mossy', 'mossy ground with a few small mossy stones'], ['bark_bits', 'forest floor with flat pieces of fallen bark'],
    ['violets', 'moss with small purple wildflowers'], ['clover_shade', 'shaded ground with clover'],
  ] },
  { name: 'soil', tiles: [
    ['soil_dark', 'plain dark forest soil'], ['soil_rich', 'rich dark brown humus soil'], ['mud_a', 'wet brown mud'],
    ['mud_b', 'wet dark mud with footprints'], ['puddle_forest', 'dark mud with a shallow puddle'], ['clay_brown', 'smooth brown clay'],
    ['peat', 'dark spongy peat ground'], ['wet_leaves', 'soaked dark leaves on mud'],
  ] },
  { name: 'old_stone', tiles: [
    ['flag_mossy', 'old mossy flagstone paving'], ['cobble_mossy', 'old mossy cobblestones'], ['paving_roots', 'broken old paving with roots growing through'],
    ['slab_moss', 'a flat stone slab covered in moss'], ['rubble_moss', 'flat mossy rubble stones'], ['tiles_ancient', 'ancient worn stone tiles with moss in the cracks'],
    ['streambed', 'wet pebbles of a dry stream bed'], ['rock_flat_moss', 'flat grey rock with moss patches'],
  ] },
  { name: 'moss_soil_edge', tiles: [
    ['gs_edge_bl', 'half green moss and half dark brown soil, a clear boundary between moss and soil'], ['gs_edge_br', 'half green moss and half dark brown soil, a clear boundary between moss and soil'],
    ['gs_edge_tl', 'half green moss and half dark brown soil, a clear boundary between moss and soil'], ['gs_edge_tr', 'half green moss and half dark brown soil, a clear boundary between moss and soil'],
    ['gs_corner_b', 'green moss with a large patch of dark brown soil'], ['gs_corner_t', 'green moss with a large patch of dark brown soil'],
    ['gs_corner_l', 'green moss with a large patch of dark brown soil'], ['gs_corner_r', 'green moss with a large patch of dark brown soil'],
  ] },
  { name: 'forest_trail', tiles: [
    ['ft_straight_x', 'a bare brown dirt trail running from the top left to the bottom right through dark leafy forest floor'],
    ['ft_straight_y', 'a bare brown dirt trail running from the top right to the bottom left through dark leafy forest floor'],
    ['ft_corner_t', 'a bare brown dirt trail turning, connecting the top left and top right edges, leafy forest floor around'],
    ['ft_corner_r', 'a bare brown dirt trail turning, connecting the top right and bottom right edges, leafy forest floor around'],
    ['ft_corner_b', 'a bare brown dirt trail turning, connecting the bottom right and bottom left edges, leafy forest floor around'],
    ['ft_corner_l', 'a bare brown dirt trail turning, connecting the bottom left and top left edges, leafy forest floor around'],
    ['ft_cross', 'a bare brown dirt trail crossroads, four ways, leafy forest floor in the corners'], ['ft_end', 'a bare brown dirt trail that ends in the middle of the tile, leafy forest floor around'],
  ] },
  { name: 'mossy_stone_path', tiles: [
    ['mp_straight_x', 'a grey mossy stone path running from the top left to the bottom right through dark forest floor'],
    ['mp_straight_y', 'a grey mossy stone path running from the top right to the bottom left through dark forest floor'],
    ['mp_corner_t', 'a grey mossy stone path turning, connecting the top left and top right edges, dark forest floor around'],
    ['mp_corner_r', 'a grey mossy stone path turning, connecting the top right and bottom right edges, dark forest floor around'],
    ['mp_corner_b', 'a grey mossy stone path turning, connecting the bottom right and bottom left edges, dark forest floor around'],
    ['mp_corner_l', 'a grey mossy stone path turning, connecting the bottom left and top left edges, dark forest floor around'],
    ['mp_cross', 'a grey mossy stone crossroads, four ways, dark forest floor in the corners'], ['mp_end', 'a grey mossy stone path that ends in the middle of the tile, dark forest floor around'],
  ] },
  { name: 'swamp_edge', tiles: [
    ['bw_straight_x', 'a wooden plank boardwalk running from the top left to the bottom right over dark moss'],
    ['bw_straight_y', 'a wooden plank boardwalk running from the top right to the bottom left over dark moss'],
    ['bw_cross', 'a wooden plank boardwalk crossing, four ways, over dark moss'], ['bw_end', 'a wooden plank boardwalk that ends in the middle of the tile, dark moss around'],
    ['mud_reeds', 'muddy ground with short green reeds'], ['shallows', 'very shallow dark water over mud, ripples'],
    ['lily_mud', 'mud with small lily pads and moss'], ['wet_moss', 'wet glistening dark green moss'],
  ] },
];
