import { env } from 'cloudflare:workers';
import { handleAuthPasswordUpdate } from '@/resources/auth/server';

export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handleAuthPasswordUpdate(request, env);
}
