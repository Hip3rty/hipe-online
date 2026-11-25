import { config } from '../config.js';
import { PostgresStore } from './postgres.js';
import { FileStore } from './filestore.js';

export async function openStore(opts = {}) {
  const url = opts.databaseUrl ?? config.databaseUrl;
  const store = url ? new PostgresStore(url, config.databaseSsl) : new FileStore(opts.devDbFile ?? config.devDbFile);
  await store.init();
  return store;
}
