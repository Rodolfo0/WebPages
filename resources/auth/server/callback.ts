import type { SupabaseAuthBindings } from './config';
import { createSupabaseServerClient } from './supabase-server';

// Supabase verifies the one-time email token, then redirects here with the PKCE code.
export async function handleAuthCallback(
  request: Request,
  bindings: SupabaseAuthBindings,
) {
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
    const server = createSupabaseServerClient(request, bindings);
    const { error } = await server.client.auth.exchangeCodeForSession(code);
    destination.searchParams.set('auth', error ? 'callback_error' : 'confirmed');
    return server.applyAuthResponse(Response.redirect(destination));
  } catch {
    destination.searchParams.set('auth', 'callback_error');
    return Response.redirect(destination);
  }
}
