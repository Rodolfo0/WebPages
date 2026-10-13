import { env } from 'cloudflare:workers';
import { handleAuthEmailConfirmation } from '@/resources/auth/server/callback';

export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handleAuthEmailConfirmation(request, env);
}
