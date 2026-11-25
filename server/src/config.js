// Configuração via variáveis de ambiente (mesmo código roda local, no Render, Koyeb, Oracle ou VPS paga)
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT || 8080),
  host: process.env.HOST || '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: process.env.DATABASE_SSL !== 'false',
  // Sem DATABASE_URL usa um arquivo JSON local (APENAS desenvolvimento)
  devDbFile: process.env.DEV_DB_FILE || path.resolve(here, '../data/dev-db.json'),
  clientDist: process.env.CLIENT_DIST || path.resolve(here, '../../client/dist'),
  // Lista separada por vírgula. Vazio = aceita qualquer origem (o app mobile usa https://localhost / capacitor://localhost)
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  saveIntervalMs: Number(process.env.SAVE_INTERVAL_MS || 60000),
  maxPlayers: Number(process.env.MAX_PLAYERS || 200),
  sessionDays: Number(process.env.SESSION_DAYS || 30),
  registerLimit: Number(process.env.REGISTER_LIMIT || 5), // cadastros por IP a cada 10 min
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  adminToken: process.env.ADMIN_TOKEN || '',
};
