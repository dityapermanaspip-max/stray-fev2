// The 64 flat walkable tiles of the meadow test set, 8 per row, in atlas order (row by row). [key, what it looks like].
// Directions follow the game: the top face is a diamond; "bottom left" etc. are screen sides of that diamond.
export const ROWS: { name: string; tiles: [string, string][] }[] = [
  { name: 'grass', tiles: [
    ['grass_a', 'plain green meadow grass'], ['grass_b', 'plain green meadow grass, slightly darker'], ['grass_c', 'plain green meadow grass, slightly lighter'],
    ['grass_d', 'plain green meadow grass with a few small tufts'], ['grass_short', 'short trimmed green grass'], ['grass_tall', 'tall wavy green grass'],
    ['grass_clover', 'grass with small clover leaves'], ['grass_dry', 'dry yellow-green grass with a bare patch'],
  ] },
  { name: 'flowers', tiles: [
    ['flowers_white', 'green grass with small white flowers'], ['flowers_yellow', 'green grass with small yellow flowers'], ['flowers_blue', 'green grass with small blue flowers'],
    ['flowers_red', 'green grass with small red flowers'], ['flowers_mixed', 'green grass with mixed colourful wildflowers'], ['flowers_daisy', 'green grass with white daisies'],
    ['flowers_dandelion', 'green grass with white dandelion puffs'], ['flowers_buttercup', 'green grass with yellow buttercups'],
  ] },
  { name: 'detail', tiles: [
    ['grass_pebbles', 'green grass with a few small pebbles'], ['grass_rocks', 'green grass with two small flat rocks'], ['grass_leaves', 'green grass with fallen brown leaves'],
    ['grass_twigs', 'green grass with a few small twigs'], ['grass_molehill', 'green grass with a small molehill of dark soil'], ['grass_burrow', 'green grass with a small dark burrow hole'],
    ['grass_trampled', 'flattened trampled green grass'], ['grass_wet', 'dark wet green grass after rain'],
  ] },
  { name: 'dirt', tiles: [
    ['dirt_a', 'plain packed brown dirt'], ['dirt_b', 'plain packed brown dirt, darker'], ['dirt_c', 'plain packed brown dirt, lighter'],
    ['dirt_pebbles', 'brown dirt with small pebbles'], ['dirt_cracked', 'dry cracked brown earth'], ['dirt_mud', 'wet dark brown mud'],
    ['dirt_puddle', 'brown mud with a small shallow puddle'], ['dirt_hoof', 'brown dirt with hoof prints'],
  ] },
  { name: 'grass_dirt_edge', tiles: [
    ['gd_edge_bl', 'half green grass and half bare brown dirt, a clear boundary between grass and dirt'], ['gd_edge_br', 'half green grass and half bare brown dirt, a clear boundary between grass and dirt'],
    ['gd_edge_tl', 'half green grass and half bare brown dirt, a clear boundary between grass and dirt'], ['gd_edge_tr', 'half green grass and half bare brown dirt, a clear boundary between grass and dirt'],
    ['gd_corner_b', 'green grass with a large patch of bare brown dirt'], ['gd_corner_t', 'green grass with a large patch of bare brown dirt'],
    ['gd_corner_l', 'green grass with a large patch of bare brown dirt'], ['gd_corner_r', 'green grass with a large patch of bare brown dirt'],
  ] },
  { name: 'dirt_path', tiles: [
    ['dp_straight_x', 'a brown dirt path running from the top left to the bottom right across green grass'],
    ['dp_straight_y', 'a brown dirt path running from the top right to the bottom left across green grass'],
    ['dp_corner_t', 'a brown dirt path turning, connecting the top left and top right edges, green grass around'],
    ['dp_corner_r', 'a brown dirt path turning, connecting the top right and bottom right edges, green grass around'],
    ['dp_corner_b', 'a brown dirt path turning, connecting the bottom right and bottom left edges, green grass around'],
    ['dp_corner_l', 'a brown dirt path turning, connecting the bottom left and top left edges, green grass around'],
    ['dp_cross', 'a brown dirt path crossroads, four ways, green grass in the corners'], ['dp_end', 'a brown dirt path that ends in the middle of the tile, green grass around'],
  ] },
  { name: 'cobble_path', tiles: [
    ['cp_straight_x', 'a grey cobblestone path running from the top left to the bottom right across green grass'],
    ['cp_straight_y', 'a grey cobblestone path running from the top right to the bottom left across green grass'],
    ['cp_corner_t', 'a grey cobblestone path turning, connecting the top left and top right edges, green grass around'],
    ['cp_corner_r', 'a grey cobblestone path turning, connecting the top right and bottom right edges, green grass around'],
    ['cp_corner_b', 'a grey cobblestone path turning, connecting the bottom right and bottom left edges, green grass around'],
    ['cp_corner_l', 'a grey cobblestone path turning, connecting the bottom left and top left edges, green grass around'],
    ['cp_cross', 'a grey cobblestone crossroads, four ways, green grass in the corners'], ['cp_end', 'a grey cobblestone path that ends in the middle of the tile, green grass around'],
  ] },
  { name: 'wear', tiles: [
    ['stones_stepping', 'green grass with flat stepping stones in a line'], ['wear_a', 'green grass worn thin showing a little brown dirt'],
    ['wear_b', 'green grass worn half bare, brown dirt showing'], ['wear_c', 'mostly bare brown dirt with a few grass tufts'],
    ['patch_dirt_a', 'a small round patch of brown dirt in green grass'], ['patch_dirt_b', 'a long oval patch of brown dirt in green grass'],
    ['patch_dirt_c', 'two small patches of brown dirt in green grass'], ['patch_dirt_d', 'a ragged patch of brown dirt in green grass'],
  ] },
];
