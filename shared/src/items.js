// Catálogo de itens. Itens de equipamento são gerados por tier; instâncias carregam raridade e bônus.
export const RARITY = [
  { id: 0, name: 'Comum', color: '#e6e6e6', mult: 1.0, bonuses: 0, weight: 600 },
  { id: 1, name: 'Incomum', color: '#62d862', mult: 1.15, bonuses: 1, weight: 260 },
  { id: 2, name: 'Raro', color: '#4aa8ff', mult: 1.3, bonuses: 1, weight: 100 },
  { id: 3, name: 'Épico', color: '#b86cff', mult: 1.5, bonuses: 2, weight: 32 },
  { id: 4, name: 'Lendário', color: '#ffb22e', mult: 1.75, bonuses: 3, weight: 7 },
  { id: 5, name: 'Mítico', color: '#ff4d6d', mult: 2.1, bonuses: 4, weight: 1 },
];

export const BONUS_TYPES = {
  hp: { name: 'Vida', fmt: (v) => `+${v} Vida` },
  mp: { name: 'Mana', fmt: (v) => `+${v} Mana` },
  crit: { name: 'Crítico', fmt: (v) => `+${v}% Crítico` },
  spd: { name: 'Vel. Ataque', fmt: (v) => `+${v}% Vel. de Ataque` },
  move: { name: 'Vel. Movimento', fmt: (v) => `+${v}% Movimento` },
  steal: { name: 'Roubo de Vida', fmt: (v) => `+${v}% Roubo de Vida` },
  atk: { name: 'Ataque', fmt: (v) => `+${v} Ataque` },
  def: { name: 'Defesa', fmt: (v) => `+${v} Defesa` },
};

export const TIER_LEVEL = [1, 5, 12, 20, 30, 40, 55];
export const TIER_PRICE = [30, 160, 650, 1900, 5200, 12500, 32000];
// cores de metal por tier (usadas para gerar os ícones/sprites dos equipamentos)
export const TIER_COLORS = ['#a0703c', '#c98a3c', '#a9b0b8', '#dfe6ee', '#7fe0d8', '#9a7cff', '#ff5a3c'];

const NAMES = {
  sword: ['Espada de Madeira', 'Espada de Bronze', 'Espada de Ferro', 'Espada de Aço', 'Espada de Mithril', 'Espada Rúnica', 'Espada Dracônica'],
  bow: ['Arco Curto', 'Arco de Caça', 'Arco Longo', 'Arco Composto', 'Arco Élfico', 'Arco Rúnico', 'Arco Dracônico'],
  staff: ['Cajado de Aprendiz', 'Cajado de Carvalho', 'Cajado de Cristal', 'Cajado Arcano', 'Cajado de Mithril', 'Cajado Rúnico', 'Cajado Dracônico'],
  shield: ['Escudo de Madeira', 'Escudo de Bronze', 'Escudo de Ferro', 'Escudo de Aço', 'Escudo de Mithril', 'Escudo Rúnico', 'Escudo Dracônico'],
  helmet: ['Capuz de Couro', 'Elmo de Bronze', 'Elmo de Ferro', 'Elmo de Aço', 'Elmo de Mithril', 'Elmo Rúnico', 'Elmo Dracônico'],
  armor: ['Gibão de Couro', 'Peitoral de Bronze', 'Peitoral de Ferro', 'Peitoral de Aço', 'Peitoral de Mithril', 'Peitoral Rúnico', 'Peitoral Dracônico'],
  boots: ['Botas de Couro', 'Botas de Bronze', 'Botas de Ferro', 'Botas de Aço', 'Botas de Mithril', 'Botas Rúnicas', 'Botas Dracônicas'],
};
const KEYS = {
  sword: ['sword_wood', 'sword_bronze', 'sword_iron', 'sword_steel', 'sword_mithril', 'sword_rune', 'sword_dragon'],
  bow: ['bow_short', 'bow_hunter', 'bow_long', 'bow_composite', 'bow_elven', 'bow_rune', 'bow_dragon'],
  staff: ['staff_apprentice', 'staff_oak', 'staff_crystal', 'staff_arcane', 'staff_mithril', 'staff_rune', 'staff_dragon'],
  shield: ['shield_wood', 'shield_bronze', 'shield_iron', 'shield_steel', 'shield_mithril', 'shield_rune', 'shield_dragon'],
  helmet: ['helmet_leather', 'helmet_bronze', 'helmet_iron', 'helmet_steel', 'helmet_mithril', 'helmet_rune', 'helmet_dragon'],
  armor: ['armor_leather', 'armor_bronze', 'armor_iron', 'armor_steel', 'armor_mithril', 'armor_rune', 'armor_dragon'],
  boots: ['boots_leather', 'boots_bronze', 'boots_iron', 'boots_steel', 'boots_mithril', 'boots_rune', 'boots_dragon'],
};
const STATS = {
  sword: { atk: [5, 9, 15, 23, 33, 45, 60] },
  bow: { atk: [4, 8, 13, 20, 29, 40, 54] },
  staff: { atk: [4, 8, 14, 21, 31, 42, 57], mp: [5, 10, 20, 30, 45, 60, 80] },
  shield: { def: [2, 4, 7, 10, 14, 19, 25] },
  helmet: { def: [1, 3, 5, 8, 11, 15, 20] },
  armor: { def: [3, 6, 10, 15, 21, 28, 36], hp: [0, 10, 20, 35, 50, 70, 100] },
  boots: { def: [1, 2, 4, 6, 8, 11, 14], move: [2, 3, 4, 5, 6, 7, 8] },
};
const SLOT_OF = { sword: 'weapon', bow: 'weapon', staff: 'weapon', shield: 'shield', helmet: 'helmet', armor: 'armor', boots: 'boots', ring: 'ring' };
export const STYLE_OF = { sword: 'melee', bow: 'distance', staff: 'magic' };

export const ITEMS = {};

for (const cat of Object.keys(NAMES)) {
  NAMES[cat].forEach((name, tier) => {
    const def = {
      key: KEYS[cat][tier], name, cat, slot: SLOT_OF[cat], tier, lvl: TIER_LEVEL[tier],
      price: Math.round(TIER_PRICE[tier] * (cat === 'sword' || cat === 'bow' || cat === 'staff' ? 1 : 0.7)),
      color: TIER_COLORS[tier], stack: false,
    };
    for (const [stat, arr] of Object.entries(STATS[cat])) def[stat] = arr[tier];
    if (cat === 'bow') def.twoHanded = true;
    ITEMS[def.key] = def;
  });
}

// Itens especiais
Object.assign(ITEMS, {
  sword_flame: { key: 'sword_flame', name: 'Lâmina Flamejante', cat: 'sword', slot: 'weapon', tier: 4, lvl: 28, atk: 36, crit: 5, price: 6000, color: '#ff7a2a', stack: false },
  staff_bone: { key: 'staff_bone', name: 'Cajado de Ossos', cat: 'staff', slot: 'weapon', tier: 2, lvl: 14, atk: 17, mp: 30, price: 900, color: '#e8e2cf', stack: false },
  ring_power: { key: 'ring_power', name: 'Anel do Poder', cat: 'ring', slot: 'ring', tier: 1, lvl: 5, atk: 3, price: 600, color: '#ff5050', stack: false },
  ring_vigor: { key: 'ring_vigor', name: 'Anel do Vigor', cat: 'ring', slot: 'ring', tier: 1, lvl: 3, hp: 60, price: 500, color: '#50ff7a', stack: false },
  ring_mana: { key: 'ring_mana', name: 'Anel da Mana', cat: 'ring', slot: 'ring', tier: 1, lvl: 3, mp: 50, price: 500, color: '#5090ff', stack: false },
  ring_frost: { key: 'ring_frost', name: 'Anel Glacial', cat: 'ring', slot: 'ring', tier: 4, lvl: 24, def: 6, hp: 120, price: 4000, color: '#bff4ff', stack: false },
  ring_dragon: { key: 'ring_dragon', name: 'Anel do Dragão', cat: 'ring', slot: 'ring', tier: 6, lvl: 45, atk: 10, hp: 250, price: 40000, color: '#ff3b2a', stack: false },

  hp_potion_s: { key: 'hp_potion_s', name: 'Poção de Vida P', cat: 'potion', heal: 60, price: 10, color: '#e8324a', stack: true },
  hp_potion_m: { key: 'hp_potion_m', name: 'Poção de Vida M', cat: 'potion', heal: 180, price: 40, color: '#ff2a55', stack: true },
  hp_potion_l: { key: 'hp_potion_l', name: 'Poção de Vida G', cat: 'potion', heal: 480, price: 120, color: '#ff5a8a', stack: true },
  mp_potion_s: { key: 'mp_potion_s', name: 'Poção de Mana P', cat: 'potion', mana: 45, price: 12, color: '#3a6cff', stack: true },
  mp_potion_m: { key: 'mp_potion_m', name: 'Poção de Mana M', cat: 'potion', mana: 140, price: 45, color: '#2a8cff', stack: true },
  mp_potion_l: { key: 'mp_potion_l', name: 'Poção de Mana G', cat: 'potion', mana: 360, price: 130, color: '#5ab8ff', stack: true },

  gold: { key: 'gold', name: 'Moedas', cat: 'gold', price: 1, color: '#ffd23a', stack: true },
});

const MATERIALS = [
  ['slime_gel', 'Gel de Slime', 3, '#6ee06e'], ['wolf_pelt', 'Pele de Lobo', 6, '#8a6a4a'],
  ['spider_silk', 'Seda de Aranha', 8, '#e8e8f0'], ['goblin_ear', 'Orelha de Goblin', 10, '#7ab04a'],
  ['orc_tusk', 'Presa de Orc', 18, '#efe3c0'], ['bone', 'Osso Antigo', 12, '#ddd6c2'],
  ['rotten_flesh', 'Carne Podre', 10, '#7a8a4a'], ['scorpion_stinger', 'Ferrão de Escorpião', 22, '#c0502a'],
  ['linen_wrap', 'Faixa de Linho', 20, '#d9c9a0'], ['ice_fang', 'Presa de Gelo', 30, '#bfe8ff'],
  ['yeti_fur', 'Pelo de Yeti', 40, '#f2f5f7'], ['imp_horn', 'Chifre de Diabrete', 45, '#ff6a3a'],
  ['demon_heart', 'Coração Demoníaco', 90, '#a0102a'], ['dark_steel', 'Aço Sombrio', 80, '#4a4a66'],
  ['dragon_scale', 'Escama de Dragão', 500, '#e0402a'],
];
for (const [key, name, price, color] of MATERIALS) ITEMS[key] = { key, name, cat: 'material', price, color, stack: true };

export function itemDef(key) {
  return ITEMS[key];
}

// Calcula os atributos finais de uma instância (base * raridade + bônus)
export function itemStats(inst) {
  const def = ITEMS[inst.k];
  if (!def) return {};
  const mult = RARITY[inst.r || 0].mult;
  const out = {};
  for (const s of ['atk', 'def', 'hp', 'mp', 'move', 'crit']) if (def[s]) out[s] = Math.round(def[s] * (s === 'move' || s === 'crit' ? 1 : mult));
  if (inst.b) for (const [s, v] of Object.entries(inst.b)) out[s] = (out[s] || 0) + v;
  return out;
}

export function sellPrice(inst) {
  const def = ITEMS[inst.k];
  if (!def || def.cat === 'gold') return 0;
  return Math.max(1, Math.floor(def.price * 0.3 * (1 + (inst.r || 0) * 0.6)));
}

export const SHOPS = {
  general: { name: 'Loja Geral', items: ['hp_potion_s', 'hp_potion_m', 'hp_potion_l', 'mp_potion_s', 'mp_potion_m', 'mp_potion_l', 'ring_vigor', 'ring_mana'] },
  smith: { name: 'Ferreiro', items: [
    ...KEYS.sword.slice(0, 4), ...KEYS.shield.slice(0, 4), ...KEYS.helmet.slice(0, 4), ...KEYS.armor.slice(0, 4), ...KEYS.boots.slice(0, 4)] },
  arcane: { name: 'Arco & Arcano', items: [...KEYS.bow.slice(0, 4), ...KEYS.staff.slice(0, 4)] },
  outpost: { name: 'Posto do Nômade', items: ['hp_potion_m', 'hp_potion_l', 'mp_potion_m', 'mp_potion_l'] },
};

export const EQUIP_BY_TIER = (tier) =>
  Object.values(ITEMS).filter((d) => d.slot && d.tier === tier && !['ring'].includes(d.cat) && KEYS[d.cat]?.includes(d.key));
