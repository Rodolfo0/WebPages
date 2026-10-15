import { env } from 'cloudflare:workers';
import { handleAuthSession } from '@/resources/auth/server';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return handleAuthSession(request, env);
}
