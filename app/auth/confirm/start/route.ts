import { handleAuthEmailConfirmationStart } from '@/resources/auth/server/callback';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return handleAuthEmailConfirmationStart(request);
}
