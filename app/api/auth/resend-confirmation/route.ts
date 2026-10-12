import { env } from 'cloudflare:workers';
import { handleAuthResendSignupConfirmation } from '@/lib/auth/actions';

export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handleAuthResendSignupConfirmation(request, env);
}
