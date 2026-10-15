import { z } from 'zod';
import type { AuthAdapter, AuthCredentials } from '../domain/auth';
import { createAuthAdapter } from './auth';
import type { AuthBindings } from './config';
import { authErrorResponse, authJson, isSameOrigin } from './http';

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function readCredentials(request: Request): Promise<AuthCredentials | null> {
  const body = await readBody(request);
  if (typeof body?.email !== 'string' || !body.email.trim() ||
    typeof body.password !== 'string' || !body.password) return null;
  return { email: body.email.trim(), password: body.password };
}

async function readEmail(request: Request): Promise<string | null> {
  const body = await readBody(request);
  return typeof body?.email === 'string' && body.email.trim() ? body.email.trim() : null;
}

async function perform(
  request: Request,
  bindings: AuthBindings,
  action: (auth: AuthAdapter) => Promise<Response>,
) {
  let auth: AuthAdapter | undefined;
  try {
    auth = createAuthAdapter(request, bindings);
    return auth.applyResponse(await action(auth));
  } catch (error) {
    const response = authErrorResponse(error);
    return auth ? auth.applyResponse(response) : response;
  }
}

function invalidOrigin() {
  return authJson({ error: 'invalid_origin', message: 'La solicitud debe venir de esta aplicación.' }, 403);
}

export async function handleAuthCheckSignupEmail(request: Request, bindings: AuthBindings) {
  if (!isSameOrigin(request, true)) return invalidOrigin();
  const email = await readEmail(request);
  if (!email || !z.email().max(254).safeParse(email).success) {
    return authJson({ error: 'invalid_email', message: 'Ingresa un correo electrónico válido.' }, 400);
  }
  return perform(request, bindings, async (auth) => authJson({
    exists: await auth.emailExists(email),
  }));
}

export async function handleAuthSignUp(request: Request, bindings: AuthBindings) {
  if (!isSameOrigin(request)) return invalidOrigin();
  const credentials = await readCredentials(request);
  if (!credentials) return authJson({ error: 'email_and_password_required' }, 400);
  return perform(request, bindings, async (auth) => authJson(await auth.signUp(
    credentials, new URL('/auth/confirm/start', request.url).toString(),
  )));
}

export async function handleAuthResendSignupConfirmation(request: Request, bindings: AuthBindings) {
  if (!isSameOrigin(request)) return invalidOrigin();
  const email = await readEmail(request);
  if (!email) return authJson({ error: 'email_required' }, 400);
  return perform(request, bindings, async (auth) => {
    await auth.resendConfirmation(email, new URL('/auth/confirm/start', request.url).toString());
    return authJson({ sent: true });
  });
}

export async function handleAuthSignIn(request: Request, bindings: AuthBindings) {
  if (!isSameOrigin(request)) return invalidOrigin();
  const credentials = await readCredentials(request);
  if (!credentials) return authJson({ error: 'email_and_password_required' }, 400);
  return perform(request, bindings, async (auth) => authJson({
    authenticated: true, user: await auth.signIn(credentials),
  }));
}

export async function handleAuthSignOut(request: Request, bindings: AuthBindings) {
  if (!isSameOrigin(request, true)) return invalidOrigin();
  return perform(request, bindings, async (auth) => {
    await auth.signOut();
    return authJson({ authenticated: false });
  });
}

export async function handleAuthPasswordRecovery(request: Request, bindings: AuthBindings) {
  if (!isSameOrigin(request)) return invalidOrigin();
  const email = await readEmail(request);
  if (!email) return authJson({ error: 'email_required' }, 400);
  return perform(request, bindings, async (auth) => {
    await auth.requestPasswordReset(email, new URL('/auth/recovery/start', request.url).toString());
    return authJson({ sent: true });
  });
}

export async function handleAuthPasswordUpdate(request: Request, bindings: AuthBindings) {
  if (!isSameOrigin(request, true)) return invalidOrigin();
  const body = await readBody(request);
  if (typeof body?.password !== 'string' || !body.password) {
    return authJson({ error: 'password_required' }, 400);
  }
  const password = body.password;
  return perform(request, bindings, async (auth) => authJson({
    updated: true, user: await auth.updatePassword(password),
  }));
}
