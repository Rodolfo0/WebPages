import { handleAuthEmailConfirmationStart } from '@/resources/auth/server';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return handleAuthEmailConfirmationStart(request);
}
