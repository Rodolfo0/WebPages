import { env } from 'cloudflare:workers';
import { handleAuthSignOut } from '@/lib/auth/actions';

export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handleAuthSignOut(request, env);
}
