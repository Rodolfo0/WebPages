import { env } from 'cloudflare:workers';
import { handleAuthCheckSignupEmail } from '@/resources/auth/server';

export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handleAuthCheckSignupEmail(request, env);
}
