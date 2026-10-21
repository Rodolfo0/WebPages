import { env } from 'cloudflare:workers';
import { createDb } from './client';

export { createDb } from './client';
export { ensureLocalUser } from './local-users';

export function getDb() {
  if (!env.DB) {
    throw new Error(
      'Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database.',
    );
  }

  return createDb(env.DB);
}
