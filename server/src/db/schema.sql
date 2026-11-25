-- Esquema PostgreSQL do Hipe Online (aplicado automaticamente na inicialização)
CREATE TABLE IF NOT EXISTS accounts (
  id          SERIAL PRIMARY KEY,
  username    TEXT NOT NULL,
  pass_hash   TEXT NOT NULL,
  banned      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_username_lower ON accounts (lower(username));

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions (account_id);

CREATE TABLE IF NOT EXISTS characters (
  id          SERIAL PRIMARY KEY,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  cls         TEXT NOT NULL,
  level       INTEGER NOT NULL DEFAULT 1,
  xp          BIGINT NOT NULL DEFAULT 0,
  rating      INTEGER NOT NULL DEFAULT 1000,
  pvp_kills   INTEGER NOT NULL DEFAULT 0,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS characters_name_lower ON characters (lower(name));
CREATE INDEX IF NOT EXISTS characters_account ON characters (account_id);
CREATE INDEX IF NOT EXISTS characters_rank_level ON characters (level DESC, xp DESC);
CREATE INDEX IF NOT EXISTS characters_rank_pvp ON characters (rating DESC);

CREATE TABLE IF NOT EXISTS character_history (
  id            BIGSERIAL PRIMARY KEY,
  character_id  INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  event         TEXT NOT NULL,
  payload       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS history_char ON character_history (character_id, created_at DESC);

-- Segurança (Supabase expõe o schema public via API REST): RLS ligado e sem políticas =
-- ninguém acessa pela API pública; só o servidor do jogo (dono das tabelas) lê e grava.
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_history ENABLE ROW LEVEL SECURITY;
