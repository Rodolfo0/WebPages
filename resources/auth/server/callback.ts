import { AuthError, type AuthAdapter, type AuthEmailLinkPurpose } from '../domain/auth';
import { createAuthAdapter } from './auth';
import type { AuthBindings } from './config';
import { isSameOrigin } from './http';

function linkSettings(purpose: AuthEmailLinkPurpose) {
  return purpose === 'recovery'
    ? { cookie: 'auth-recovery-state', path: '/auth/recovery', success: 'recovery', error: 'recovery_error', expired: 'recovery_link_expired' }
    : { cookie: 'auth-confirmation-state', path: '/auth/confirm', success: 'confirmed', error: 'callback_error', expired: 'link_expired' };
}

function redirectToRoot(request: Request, result: string, status = 303) {
  const destination = new URL('/', request.url);
  destination.searchParams.set('auth', result);
  return new Response(null, { status, headers: {
    Location: destination.toString(), 'Cache-Control': 'private, no-store',
    Pragma: 'no-cache', 'Referrer-Policy': 'no-referrer',
  } });
}

function stateCookie(request: Request, purpose: AuthEmailLinkPurpose, state: string, maxAge: number) {
  const settings = linkSettings(purpose);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return settings.cookie + '=' + state + '; Path=' + settings.path + '; Max-Age=' + maxAge + '; HttpOnly; SameSite=Lax' + secure;
}

function clearState(response: Response, request: Request, purpose: AuthEmailLinkPurpose) {
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', stateCookie(request, purpose, '', 0));
  return new Response(response.body, { status: response.status, headers });
}

// GET never consumes a one-time token: email scanners can safely visit it.
function startEmailLink(request: Request, purpose: AuthEmailLinkPurpose) {
  const url = new URL(request.url);
  const settings = linkSettings(purpose);
  const tokenHash = url.searchParams.get('token_hash');
  if (!tokenHash) {
    if (url.searchParams.has('code') || url.searchParams.has('error_code')) {
      const callback = new URL('/auth/callback', url);
      callback.search = url.search;
      if (purpose === 'recovery') callback.searchParams.set('flow', 'recovery');
      return new Response(null, { status: 303, headers: {
        Location: callback.toString(), 'Cache-Control': 'private, no-store',
        Pragma: 'no-cache', 'Referrer-Policy': 'no-referrer',
      } });
    }
    return redirectToRoot(request, settings.error);
  }
  const state = crypto.randomUUID();
  const destination = new URL(settings.path, url);
  destination.searchParams.set('token_hash', tokenHash);
  destination.searchParams.set('state', state);
  return new Response(null, { status: 303, headers: {
    Location: destination.toString(), 'Cache-Control': 'private, no-store',
    Pragma: 'no-cache', 'Referrer-Policy': 'no-referrer',
    'Set-Cookie': stateCookie(request, purpose, state, 600),
  } });
}

async function verifyEmailLink(request: Request, bindings: AuthBindings, purpose: AuthEmailLinkPurpose) {
  const settings = linkSettings(purpose);
  let auth: AuthAdapter | undefined;
  let result = settings.error;
  try {
    if (!isSameOrigin(request, true)) throw new Error('Invalid origin.');
    const form = await request.formData();
    const tokenHash = form.get('token_hash');
    const submittedState = form.get('state');
    const cookieState = (request.headers.get('cookie') ?? '').split(';')
      .map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(settings.cookie + '='))
      ?.slice(settings.cookie.length + 1);
    if (typeof tokenHash !== 'string' || !tokenHash ||
      typeof submittedState !== 'string' || !submittedState || submittedState !== cookieState) {
      throw new Error('Invalid confirmation state.');
    }
    auth = createAuthAdapter(request, bindings);
    await auth.verifyEmailLink(tokenHash, purpose);
    result = settings.success;
  } catch (error) {
    if (error instanceof AuthError && error.code === 'link_expired') result = settings.expired;
  }
  const response = redirectToRoot(request, result);
  return clearState(auth ? auth.applyResponse(response) : response, request, purpose);
}

export function handleAuthEmailConfirmationStart(request: Request) {
  return startEmailLink(request, 'confirmation');
}
export function handleAuthEmailConfirmation(request: Request, bindings: AuthBindings) {
  return verifyEmailLink(request, bindings, 'confirmation');
}
export function handleAuthPasswordRecoveryStart(request: Request) {
  return startEmailLink(request, 'recovery');
}
export function handleAuthPasswordRecoveryVerification(request: Request, bindings: AuthBindings) {
  return verifyEmailLink(request, bindings, 'recovery');
}

// Compatibility for already-sent PKCE links. New templates use TokenHash.
export async function handleAuthCallback(request: Request, bindings: AuthBindings) {
  const url = new URL(request.url);
  const settings = linkSettings(url.searchParams.get('flow') === 'recovery' ? 'recovery' : 'confirmation');
  const code = url.searchParams.get('code');
  if (!code) {
    return redirectToRoot(request, url.searchParams.get('error_code') === 'otp_expired' ? settings.expired : settings.error, 302);
  }
  let auth: AuthAdapter | undefined;
  let result = settings.error;
  try {
    auth = createAuthAdapter(request, bindings);
    await auth.exchangeCodeForSession(code);
    result = settings.success;
  } catch {
    result = settings.error;
  }
  const response = redirectToRoot(request, result, 302);
  return auth ? auth.applyResponse(response) : response;
}
