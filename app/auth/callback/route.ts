import { env } from 'cloudflare:workers';
import { handleAuthCallback } from '@/resources/auth/server';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return handleAuthCallback(request, env);
}
