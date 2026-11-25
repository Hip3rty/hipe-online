// NPCs fixos do mundo. Posições em tiles. O servidor valida a distância nas interações.
function outpost(angle, r, side = 3) {
  const a = (angle * Math.PI) / 180;
  return {
    x: Math.round(128 + Math.cos(a) * r - Math.sin(a) * side) + 0.5,
    y: Math.round(128 + Math.sin(a) * r + Math.cos(a) * side) + 0.5,
  };
}

export const NPCS = [
  { id: 'priest', sprite: ['dungeon', 100], name: 'Irmã Celeste', role: 'healer', x: 128.5, y: 116.2,
    look: { skin: 1, hair: 3, hairColor: 6, shirt: 7, pants: 7 },
    greet: 'Que a luz te proteja, viajante. Posso restaurar sua vida e mana.' },
  { id: 'merchant', sprite: ['dungeon', 98], name: 'Bento, o Mercador', role: 'shop', shop: 'general', x: 139.5, y: 125.2,
    look: { skin: 0, hair: 1, hairColor: 2, shirt: 3, pants: 1 },
    greet: 'Poções fresquinhas! Compro também o que você trouxer da caça.' },
  { id: 'smith', sprite: ['dungeon', 86], name: 'Gorm, o Ferreiro', role: 'shop', shop: 'smith', x: 140.5, y: 137.2,
    look: { skin: 2, hair: 4, hairColor: 5, shirt: 5, pants: 2, beard: true },
    greet: 'Aço bom não se encontra em qualquer canto. Dê uma olhada.' },
  { id: 'banker', sprite: ['dungeon', 99], name: 'Dona Odete', role: 'bank', x: 115.5, y: 125.2,
    look: { skin: 0, hair: 2, hairColor: 7, shirt: 6, pants: 0 },
    greet: 'Seus pertences ficam seguros no Banco de Hipe.' },
  { id: 'arcane', sprite: ['dungeon', 88], name: 'Lys, a Arqueira', role: 'shop', shop: 'arcane', x: 115.5, y: 137.2,
    look: { skin: 1, hair: 5, hairColor: 3, shirt: 2, pants: 3 },
    greet: 'Arcos e cajados encantados. Escolha bem sua arma.' },
  { id: 'captain', sprite: ['dungeon', 96], name: 'Capitã Lyra', role: 'quest', x: 126.5, y: 141.6,
    look: { skin: 2, hair: 2, hairColor: 1, shirt: 4, pants: 2 },
    greet: 'A vila precisa de heróis. Tenho trabalho para você.' },
  { id: 'nomad', sprite: ['dungeon', 85], name: 'Zahir, o Nômade', role: 'shop', shop: 'outpost', outpost: true, ...outpost(60, 70),
    look: { skin: 2, hair: 0, hairColor: 0, shirt: 1, pants: 1 },
    greet: 'O deserto não perdoa. Leve água... digo, poções.' },
  { id: 'hermit', sprite: ['dungeon', 84], name: 'Velho Ulfric', role: 'quest', outpost: true, ...outpost(240, 82),
    look: { skin: 0, hair: 4, hairColor: 7, shirt: 6, pants: 6, beard: true },
    greet: 'Poucos sobem até aqui. O frio guarda segredos.' },
  { id: 'warden', sprite: ['dungeon', 97], name: 'Guardião Kael', role: 'quest', outpost: true, ...outpost(300, 80),
    look: { skin: 1, hair: 1, hairColor: 0, shirt: 0, pants: 0 },
    greet: 'Além destes portões dorme o Dragão Abissal. Volte se tiver juízo.' },
];

export const NPC_BY_ID = Object.fromEntries(NPCS.map((n) => [n.id, n]));
