import { env } from 'cloudflare:workers';
import { handleAuthSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return handleAuthSession(request, env);
}
