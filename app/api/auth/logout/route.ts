import { env } from 'cloudflare:workers';
import { handleAuthSignOut } from '@/resources/auth/server/actions';

export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handleAuthSignOut(request, env);
}
