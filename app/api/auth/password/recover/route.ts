import { env } from 'cloudflare:workers';
import { handleAuthPasswordRecovery } from '@/resources/auth/server';

export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handleAuthPasswordRecovery(request, env);
}
