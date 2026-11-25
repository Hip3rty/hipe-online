// Constantes globais do Hipe Online (usadas por cliente e servidor)
export const PROTOCOL_VERSION = 1;
export const GAME_NAME = 'Hipe Online';

export const TILE = 16; // pixels por tile
export const MAP_W = 256;
export const MAP_H = 256;
export const WORLD_SEED = 0x41f3c9;

export const TICK_RATE = 20; // ticks de simulação por segundo (servidor)
export const SNAPSHOT_EVERY = 2; // envia snapshot a cada N ticks (10 Hz)
export const VIEW_RADIUS = 17; // raio (tiles) de interesse por jogador
export const CELL = 16; // tamanho da célula da grade espacial (tiles)
export const ACTIVE_RADIUS = 26; // monstros fora desse raio de qualquer jogador "dormem"

export const WALK_SPEED = 3.0; // tiles/s
export const RUN_SPEED = 4.6; // tiles/s
export const RUN_THRESHOLD = 0.82; // magnitude do joystick para correr
export const PLAYER_RADIUS = 0.3;
export const MONSTER_RADIUS = 0.32;

export const INV_SIZE = 30;
export const BANK_SIZE = 48;
export const MAX_STACK = 999;
export const MAX_LEVEL = 200;
export const MAX_CHARS_PER_ACCOUNT = 3;

export const PVP_MIN_LEVEL = 10; // proteção para novatos
export const SKULL_MS = 3 * 60 * 1000;
export const LOOT_OWNER_MS = 25 * 1000;
export const LOOT_DESPAWN_MS = 120 * 1000;
export const COMBAT_TAG_MS = 15 * 1000;
export const POTION_CD_MS = 900;
export const PICKUP_RANGE = 1.1;
export const NPC_RANGE = 2.6;

export const EQUIP_SLOTS = ['weapon', 'shield', 'helmet', 'armor', 'boots', 'ring'];

export const DIRS = { down: 0, left: 1, right: 2, up: 3 };

// Estados de animação sincronizados
export const ANIM = { idle: 0, walk: 1, run: 2, attack: 3, hurt: 4, dead: 5 };

export const NAME_RE = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 ]{2,15}$/;
export const USER_RE = /^[a-zA-Z0-9_]{3,20}$/;
