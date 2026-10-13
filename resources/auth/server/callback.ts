import { parseCookieHeader } from '@supabase/ssr';
import type { SupabaseAuthBindings } from './config';
import { createSupabaseServerClient } from './supabase-server';

const CONFIRMATION_STATE_COOKIE = 'auth-confirmation-state';

function redirectToRoot(request: Request, result: string) {
  const destination = new URL('/', request.url);
  destination.searchParams.set('auth', result);
  return Response.redirect(destination, 303);
}

function clearConfirmationStateCookie(response: Response, request: Request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  const headers = new Headers(response.headers);
  headers.append(
    'Set-Cookie',
    `${CONFIRMATION_STATE_COOKIE}=; Path=/auth/confirm; Max-Age=0; HttpOnly; SameSite=Lax${secure}`,
  );
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Pragma', 'no-cache');
  headers.set('Referrer-Policy', 'no-referrer');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// This first hop does not consume the one-time token. Email link scanners can
// load the page; only the user's explicit form submission verifies the token.
export function handleAuthEmailConfirmationStart(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  if (!tokenHash) {
    // Keep the default Supabase ConfirmationURL template working during the
    // migration. It verifies through Supabase and returns a PKCE code here.
    if (url.searchParams.has('code') || url.searchParams.has('error_code')) {
      const legacyCallback = new URL('/auth/callback', url);
      legacyCallback.search = url.search;
      return new Response(null, {
        status: 303,
        headers: {
          Location: legacyCallback.toString(),
          'Cache-Control': 'private, no-store',
          Pragma: 'no-cache',
          'Referrer-Policy': 'no-referrer',
        },
      });
    }

    return redirectToRoot(request, 'callback_error');
  }

  const state = crypto.randomUUID();
  const destination = new URL('/auth/confirm', url);
  destination.searchParams.set('token_hash', tokenHash);
  destination.searchParams.set('state', state);

  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return new Response(null, {
    status: 303,
    headers: {
      Location: destination.toString(),
      'Cache-Control': 'private, no-store',
      Pragma: 'no-cache',
      'Referrer-Policy': 'no-referrer',
      'Set-Cookie': `${CONFIRMATION_STATE_COOKIE}=${state}; Path=/auth/confirm; Max-Age=600; HttpOnly; SameSite=Lax${secure}`,
    },
  });
}

export async function handleAuthEmailConfirmation(
  request: Request,
  bindings: SupabaseAuthBindings,
) {
  const url = new URL(request.url);

  try {
    const form = await request.formData();
    const tokenHash = form.get('token_hash');
    const submittedState = form.get('state');
    const cookieState = parseCookieHeader(
      request.headers.get('cookie') ?? '',
    ).find(({ name }) => name === CONFIRMATION_STATE_COOKIE)?.value;

    if (
      typeof tokenHash !== 'string' ||
      !tokenHash ||
      typeof submittedState !== 'string' ||
      !submittedState ||
      !cookieState ||
      submittedState !== cookieState
    ) {
      return clearConfirmationStateCookie(
        redirectToRoot(request, 'callback_error'),
        request,
      );
    }

    const server = createSupabaseServerClient(request, bindings);
    const { error } = await server.client.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'email',
    });
    const result = error
      ? error.code === 'otp_expired'
        ? 'link_expired'
        : 'callback_error'
      : 'confirmed';

    return clearConfirmationStateCookie(
      server.applyAuthResponse(redirectToRoot(request, result)),
      request,
    );
  } catch {
    return clearConfirmationStateCookie(
      redirectToRoot(request, 'callback_error'),
      request,
    );
  }
}

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
