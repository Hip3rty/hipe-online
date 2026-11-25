# Hipe Online

MMORPG 2D em pixel art para Android e iOS (e navegador): mundo aberto contínuo, multiplayer em tempo real com servidor autoritativo, três estilos de combate com skills independentes, 17 monstros, loot com 6 raridades, lojas, banco, missões, conquistas, PvP com ranking e chat.

## Tecnologia (e por quê)

| Parte | Escolha | Motivo |
|---|---|---|
| Cliente | JavaScript + Canvas 2D (sem engine), empacotado com **Capacitor** | Leve (cerca de 130 KB de JS) para celulares modestos. Um único código gera o APK, o app iOS e a versão web. |
| Servidor | **Node.js + WebSocket (`ws`)**, loop de 20 ticks/s | Mesma linguagem do cliente: mapa, regras e fórmulas ficam em `shared/` e rodam iguais dos dois lados. |
| Banco | **PostgreSQL** (Supabase/Neon/qualquer um) | Plano grátis permanente. Dados JSONB por personagem e colunas indexadas para ranking. |
| Hospedagem | **Docker** (Render free + Supabase free) | Sem cartão; dá para migrar para pago sem reescrever nada. Veja [docs/DEPLOY.md](docs/DEPLOY.md). |

## Estrutura

```
shared/src/      regras do jogo compartilhadas (cliente + servidor)
  mapgen.js      gera o mundo 256x256 de forma determinística (mesma semente nos dois lados)
  regions.js     8 regiões (vila, floresta, goblins, deserto, vulcão, caverna, montanhas, masmorra)
  monsters.js    17 monstros (atributos, drops, IA, arte)
  items.js       armas/armaduras por tier, raridades, poções, materiais, lojas
  rules.js       classes, atributos, fórmulas de dano/XP, habilidades
  quests.js      missões (caça, coleta, exploração, diárias) e conquistas
  movement.js    movimento com colisão (servidor valida, cliente prevê)
server/src/
  index.js       HTTP (cliente web, /health, /api/status) + WebSocket /ws
  auth.js        cadastro/login (bcrypt), sessões
  db/            PostgreSQL (produção) e arquivo JSON (só desenvolvimento)
  net/           conexão, limite de mensagens, seleção de personagem
  game/          world (loop + AOI), combat, ai, progression, inventory, loot, handlers, chat
server/test/     teste de integração multiplayer (2 clientes WebSocket reais)
client/src/
  main.js        liga rede, estado, renderização, HUD e painéis
  net.js         WebSocket com reconexão automática e retomada de sessão
  game/state.js  interpolação das entidades remotas + predição do jogador local
  gfx/           renderizador, efeitos, tiles, objetos, humanoides, criaturas, ícones
  ui/            telas (login/criação), HUD mobile (joystick, botões), painéis
  audio.js       efeitos sonoros e música chiptune sintetizados (WebAudio)
client/public/assets/   folhas de sprites Kenney (CC0)
```

## Rodar no PC (desenvolvimento)

Requisitos: Node.js 20+.

```powershell
npm install
```
```powershell
npm run build
```
```powershell
npm start
```
Abra http://localhost:8080. Sem `DATABASE_URL`, os dados ficam em `server/data/dev-db.json` (somente para testes).

Com recarga automática do cliente: deixe `npm start` rodando e, em outro terminal, rode `npm run dev:client` (http://localhost:5173, já encaminha `/ws` para o servidor).

## Testar o multiplayer

- **Automático:** `npm test` sobe o servidor real e conecta 2 clientes. Testa cadastro, login, um ver o outro, movimento validado (tentativa de speed hack), chat global/privado, lista online, bloqueio de PvP na vila, combate, XP, loot, loja, persistência e reconexão.
- **Manual:** abra http://localhost:8080 em duas janelas (uma anônima), crie duas contas e jogue lado a lado. Pelo celular no mesmo Wi-Fi, use `http://IP-DO-PC:8080`.

## Controles

- **Celular:** joystick à esquerda (empurrar até o fim = correr), ⚔ ataca o monstro mais próximo (ataque automático contínuo), dois botões de habilidade, dois de poção, "Falar" perto de NPCs e baús. Tocar em um monstro ou jogador seleciona como alvo; tocar no chão ou em um NPC faz o personagem andar até lá.
- **PC:** WASD/setas, Espaço ataca, 1/2 habilidades, Q/E poções, F falar, I inventário, C personagem, J missões, M mapa, Enter chat.

## Sistemas implementados

- Criação de personagem: nome, classe inicial (Espadachim, Arqueiro, Mago), pele, 6 cabelos, 8 cores de cabelo, roupa e calça. Até 3 personagens por conta.
- Animações: parado, andando, correndo, atacando, recebendo dano, morrendo.
- Níveis, XP, HP/MP com regeneração, 4 atributos com pontos por nível, skills Corpo a Corpo/Distância/Magia que sobem independentemente com o uso, 6 habilidades.
- Mundo de 256x256 tiles em 8 regiões conectadas, 669 pontos de spawn, chefe Dragão Abissal, 6 baús secretos, 3 postos avançados com NPCs.
- IA: vagar, detectar, perseguir, atacar (corpo a corpo ou à distância), desistir e voltar. Só monstros perto de jogadores são simulados.
- Loot no chão com prioridade para quem causou mais dano, 6 raridades com bônus aleatórios.
- Inventário (30 slots, empilhar, equipar, usar, descartar, mover, organizar), banco (48 slots), 4 lojas (compra e venda), cura no templo.
- Missões de caça, coleta e exploração, diárias, 12 conquistas, ranking de nível e de PvP, lista online.
- PvP só fora das zonas seguras e a partir do nível 10, caveira para agressores, rating Elo, ouro do derrotado. Anti-abuso: mesma conta/rede ou abate repetido em 30 min não rende nada; matar alguém muito mais fraco aumenta a caveira.
- Chat global, local e privado.

## Créditos de arte

- Terreno, árvores, casas, cercas, NPCs, slime, aranha, diabrete, poções e baús: **Kenney — Tiny Town e Tiny Dungeon** (www.kenney.nl), licença **CC0** (uso livre, inclusive comercial). Licenças em `client/public/assets/`.
- Demais sprites (personagens customizáveis, lobos, escorpião, dragão, humanoides, fonte, ícones de equipamentos, água/lava/neve) e todo o áudio: gerados por código neste projeto.
