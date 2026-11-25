// Regiões do mundo. O mapa é uma ilha contínua: cidade no centro, floresta ao redor
// e setores externos com dificuldade crescente.
export const REGIONS = [
  { id: 0, key: 'ocean', name: 'Mar', pvp: false, safe: true, minimap: '#2a5d9c', music: 'field', monsters: [] },
  { id: 1, key: 'town', name: 'Vila de Hipe', pvp: false, safe: true, minimap: '#b7a27c', music: 'town', monsters: [] },
  { id: 2, key: 'forest', name: 'Floresta Verdejante', pvp: false, safe: false, minimap: '#3f8f3a', music: 'field', levels: [1, 7],
    monsters: [['slime', 5], ['wolf', 3], ['spider', 2]] },
  { id: 3, key: 'goblin', name: 'Campo dos Goblins', pvp: true, safe: false, minimap: '#a08a3d', music: 'field', levels: [8, 15],
    monsters: [['goblin', 5], ['goblin_archer', 3], ['orc', 2]] },
  { id: 4, key: 'desert', name: 'Deserto de Areias Rubras', pvp: true, safe: false, minimap: '#e0c27a', music: 'desert', levels: [16, 24],
    monsters: [['scorpion', 5], ['mummy', 3]] },
  { id: 5, key: 'volcano', name: 'Vulcão Brasa Eterna', pvp: true, safe: false, minimap: '#8c3b2a', music: 'danger', levels: [34, 45],
    monsters: [['imp', 5], ['demon', 2]] },
  { id: 6, key: 'cave', name: 'Caverna dos Esqueletos', pvp: true, safe: false, minimap: '#6a6470', music: 'cave', levels: [12, 20],
    monsters: [['skeleton', 5], ['zombie', 3], ['skeleton_mage', 2]] },
  { id: 7, key: 'frozen', name: 'Montanhas Congeladas', pvp: true, safe: false, minimap: '#cfe6f2', music: 'cave', levels: [24, 34],
    monsters: [['ice_wolf', 5], ['yeti', 2]] },
  { id: 8, key: 'dungeon', name: 'Masmorra Abissal', pvp: true, safe: false, minimap: '#4b3a5c', music: 'danger', levels: [42, 60],
    monsters: [['death_knight', 4], ['demon', 2]] },
];

export const REGION_BY_KEY = Object.fromEntries(REGIONS.map((r) => [r.key, r]));

// Tipos de terreno
export const T = {
  WATER: 0, GRASS: 1, FOREST: 2, PATH: 3, SAND: 4, SNOW: 5, CAVE: 6, ASH: 7, LAVA: 8,
  BRICK: 9, PLAZA: 10, DIRT: 11, ICE: 12, DEEP: 13, CAVEWALL: 14, DUNGEONWALL: 15,
};
export const BLOCKING_TILES = new Set([T.WATER, T.LAVA, T.DEEP, T.CAVEWALL, T.DUNGEONWALL]);
