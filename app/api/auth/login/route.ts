import { env } from 'cloudflare:workers';
import { handleAuthSignIn } from '@/resources/auth/server';

export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handleAuthSignIn(request, env);
}
