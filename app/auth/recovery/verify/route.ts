import { env } from 'cloudflare:workers';
import { handleAuthPasswordRecoveryVerification } from '@/resources/auth/server';

export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handleAuthPasswordRecoveryVerification(request, env);
}
