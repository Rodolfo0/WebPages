import { env } from 'cloudflare:workers';
import { handleAuthSignUp } from '@/resources/auth/server';

export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handleAuthSignUp(request, env);
}
