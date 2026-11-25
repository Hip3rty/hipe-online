# Hospedagem gratuita do Hipe Online

Objetivo: servidor na nuvem, banco permanente e jogadores entrando de qualquer lugar, com o seu PC desligado.

## 1. Comparação (pesquisada em novembro de 2026)

| Serviço | O que dá de graça | Limitações que importam para um MMO | Cartão? |
|---|---|---|---|
| **Render** (servidor) | 1 web service Docker, 512 MB RAM, 750 h/mês, WebSocket ok | **Dorme após 15 min sem tráfego** (até ~1 min para acordar). Disco efêmero. O Postgres grátis do Render **expira em 30 dias**: não use para o banco. | Não |
| **Koyeb** (servidor) | 1 instância, 512 MB RAM, 0,1 vCPU | Dorme após **1 h** sem tráfego (acorda em segundos). Só Frankfurt/Washington. Notícias de 2026 citam uma pré-autorização de US$ 29 no cartão. | Possível |
| **Oracle Cloud Always Free** (servidor) | VM ARM de até 4 núcleos e 24 GB, **24 h por dia** | Exige cartão, cadastro costuma ser recusado, e você administra a VM (Linux, Docker, firewall). | Sim |
| **Supabase** (banco) | Postgres 500 MB, sem limite de horas de CPU | Projeto **pausa após 7 dias sem nenhum acesso** (com jogadores ativos não pausa). | Não |
| **Neon** (banco) | Postgres 1 GB, 100 CU-hora/mês | Suspende após 5 min ocioso (acorda sozinho). **Um servidor de jogo sempre conectado pode estourar as horas** e o banco fica suspenso até o mês seguinte. | Não |

### Escolha recomendada

- **Banco: Supabase.** Não tem limite de horas de CPU. Com um MMO ativo, a pausa de 7 dias nunca acontece.
- **Servidor: Render (Docker).** Grátis sem cartão, WebSocket nativo, deploy automático pelo GitHub.
- **Manter acordado:** um monitor gratuito (UptimeRobot ou cron-job.org) chama `https://SEU-APP.onrender.com/health` a cada 10 minutos. Um único serviço acordado o mês todo usa cerca de 744 h, dentro das 750 h grátis.

**Limitação honesta:** nenhum plano gratuito sem cartão garante um servidor 24 h por dia. Com o monitor, o Render fica praticamente sempre ligado. Se o monitor falhar, o primeiro jogador espera até 1 min (o app mostra "Conectando ao servidor..." e reconecta sozinho). O progresso nunca se perde, porque fica no Supabase.

**Plano B, sempre ligado:** Oracle Cloud Always Free (precisa de cartão) rodando o mesmo `Dockerfile`.

**Migrar para pago depois:** o código não muda. Basta trocar a variável `DATABASE_URL` e/ou o host do Docker (Render Starter, Fly.io, VPS...).

## 2. Banco de dados: Supabase (5 min)

> **Já feito:** o projeto `hipe-online` (ref `jyxfstsxzgxyrxlsgpqq`, região São Paulo, plano grátis) foi criado, com as tabelas e o RLS já aplicados. Falta só definir a senha do banco: **Project Settings › Database › Reset database password**. Depois, copie a URI no botão **Connect › Session pooler**.

1. Crie uma conta em https://supabase.com, depois clique em **New project**. Região: *South America (São Paulo)*. Anote a senha do banco.
2. Vá em **Project Settings › Database › Connection string**, escolha **Session pooler** e copie a URI, algo como
   `postgresql://postgres.abcd:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`
3. Pronto. As tabelas (`accounts`, `sessions`, `characters`, `character_history`) são criadas automaticamente pelo servidor na primeira inicialização (`server/src/db/schema.sql`).

## 3. Servidor: Render (10 min)

1. Coloque o projeto em um repositório no GitHub (sem a pasta `node_modules`; o `.gitignore` já cuida disso).
2. Em https://render.com, clique em **New › Blueprint** e selecione o repositório. O arquivo `render.yaml` já configura tudo (Docker, plano free, health check `/health`).
3. Quando o Render pedir, cole a URI do Supabase em **DATABASE_URL**.
4. Aguarde o deploy. O endereço será algo como `https://hipe-online.onrender.com`.
   - Abrir esse endereço no navegador já carrega o jogo (versão web).
   - `https://hipe-online.onrender.com/api/status` mostra quantos jogadores estão online e qual banco está em uso (`"db":"postgres"`).
5. **Mantenha acordado:** em https://uptimerobot.com, crie um monitor HTTP para `https://hipe-online.onrender.com/health` com intervalo de 10 min.

### Variáveis de ambiente

| Variável | Para que serve |
|---|---|
| `DATABASE_URL` | URI do Postgres (obrigatória em produção) |
| `DATABASE_SSL` | `true` (padrão) |
| `SAVE_INTERVAL_MS` | intervalo de salvamento automático (padrão 60000) |
| `MAX_PLAYERS` | limite de jogadores simultâneos |
| `ALLOWED_ORIGINS` | restringe origens do WebSocket. Deixe vazio para o app mobile funcionar. |
| `REGISTER_LIMIT` | cadastros por IP a cada 10 min (anti-spam) |
| `LOG_LEVEL` | `info` ou `debug` |

## 4. APK apontando para a nuvem

```powershell
powershell -ExecutionPolicy Bypass -File tools/build-apk.ps1 -Server "wss://hipe-online.onrender.com/ws"
```
O APK fica em `dist-apk/HipeOnline.apk`. Requer JDK 17 e Android SDK (platform 35). O script coloca o cache do Gradle e a pasta temporária em `D:\hipe-gradle-cache`, porque o Java falha com acentos no caminho do usuário. Mesmo sem recompilar, dá para trocar o endereço no app: tela de login › **Servidor**.

## 5. Logs e monitoramento

- O painel do Render mostra os logs em JSON: login, personagem criado, salvamentos e, a cada minuto, a linha `metrics` (jogadores, monstros, tempo de tick, KB enviados, memória).
- `/health` serve para o monitor; `/api/status` dá o estado resumido.
- Ao receber SIGTERM (deploy/reinício), o servidor avisa os jogadores, salva todos os personagens e só então encerra. Os clientes reconectam sozinhos.

## 6. Segurança implementada

- Senhas com **bcrypt**; sessões com token aleatório de 256 bits, guardado só como hash SHA-256 e expirando em 30 dias.
- Limite de tentativas de login por IP e por usuário; limite de cadastros por IP.
- Servidor **autoritativo**: o cliente só envia intenções (direção, alvo, "usar item"). Movimento, alcance, recarga, dano, XP, loot, compras e missões são calculados e validados no servidor.
- Limite de mensagens por conexão (token bucket), tamanho máximo de mensagem de 8 KB, heartbeat que derruba conexões mortas, um personagem por conta no mundo.
- Chat com limite de frequência, remoção de HTML e filtro de palavrões.
