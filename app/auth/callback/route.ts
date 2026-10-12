import { env } from 'cloudflare:workers';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';

export const dynamic = 'force-dynamic';

// Supabase verifies the one-time email token, then redirects here with the PKCE code.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const destination = new URL('/', url);

  if (!code) {
    const result =
      url.searchParams.get('error_code') === 'otp_expired'
        ? 'link_expired'
        : 'callback_error';
    destination.searchParams.set('auth', result);
    return Response.redirect(destination);
  }

  try {
    const server = createSupabaseServerClient(request, env);
    const { error } = await server.client.auth.exchangeCodeForSession(code);
    destination.searchParams.set('auth', error ? 'callback_error' : 'confirmed');
    return server.applyAuthResponse(Response.redirect(destination));
  } catch {
    destination.searchParams.set('auth', 'callback_error');
    return Response.redirect(destination);
  }
}
