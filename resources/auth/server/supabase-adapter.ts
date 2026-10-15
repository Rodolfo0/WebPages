import type { AuthError as ProviderError, User } from '@supabase/supabase-js';
import { AuthError, type AuthAdapter, type AuthUser } from '../domain/auth';
import type { AuthBindings } from './config';
import { createSupabaseServerClient } from './supabase-server';

const expiredSessionCodes = new Set([
  'session_expired', 'refresh_token_not_found', 'refresh_token_already_used',
]);
const invalidSessionCodes = new Set([
  'bad_jwt', 'no_authorization', 'session_not_found', 'user_not_found',
]);

function unavailable() {
  return new AuthError('auth_provider_unavailable', 502,
    'No se pudo conectar con el servicio de autenticación. Inténtalo de nuevo.');
}

function sessionFailure(error: ProviderError): AuthError | null {
  if (error.name === 'AuthSessionMissingError') {
    return new AuthError('authentication_required', 401, 'Inicia sesión para continuar.');
  }
  if (error.code && expiredSessionCodes.has(error.code)) {
    return new AuthError('session_expired', 401, 'Tu sesión venció. Inicia sesión de nuevo.');
  }
  if (error.status === 401 || error.name === 'AuthInvalidTokenResponseError' ||
    (error.code && invalidSessionCodes.has(error.code))) {
    return new AuthError('session_invalid', 401, 'La sesión no es válida. Inicia sesión de nuevo.');
  }
  return null;
}

function identity(user: User | null): AuthUser {
  if (typeof user?.id !== 'string' || !user.id.trim() ||
    typeof user.email !== 'string' || !user.email.trim()) {
    throw new AuthError('session_invalid', 401, 'La sesión no contiene una identidad válida.');
  }
  return { id: user.id, email: user.email };
}

function checkOperation(error: ProviderError | null, failure: AuthError) {
  if (!error) return;
  if (!error.status || error.status >= 500 || error.name === 'AuthRetryableFetchError') {
    throw unavailable();
  }
  throw failure;
}

export function createSupabaseAuthAdapter(request: Request, bindings: AuthBindings): AuthAdapter {
  let server: ReturnType<typeof createSupabaseServerClient>;
  try {
    server = createSupabaseServerClient(request, bindings);
  } catch {
    throw new AuthError('auth_not_configured', 503, 'El servicio de autenticación no está configurado.');
  }
  let checkedUser: Promise<AuthUser | null> | undefined;
  let rejectedSession: AuthError | null = null;

  async function discardInvalidSession() {
    // The SDK owns session cookies and their deletion, including chunked cookies.
    try {
      await server.client.auth.signOut({ scope: 'local' });
    } catch {
      // A rejected session must never be accepted if cleanup is unavailable.
    }
  }

  async function loadUser(): Promise<AuthUser | null> {
    try {
      const { data, error } = await server.client.auth.getUser();
      if (error) {
        const failure = sessionFailure(error);
        if (!failure) throw unavailable();
        rejectedSession = failure;
        if (failure.code !== 'authentication_required') await discardInvalidSession();
        return null;
      }
      if (!data.user) return null;
      return identity(data.user);
    } catch (error) {
      if (error instanceof AuthError) {
        if (error.code === 'session_invalid') {
          rejectedSession = error;
          await discardInvalidSession();
          return null;
        }
        throw error;
      }
      throw unavailable();
    }
  }

  async function operation<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw unavailable();
    }
  }

  function forgetUser() {
    checkedUser = undefined;
    rejectedSession = null;
  }

  const adapter: AuthAdapter = {
    getUser() {
      checkedUser ??= loadUser();
      return checkedUser;
    },
    async requireUser() {
      const user = await adapter.getUser();
      if (!user) throw rejectedSession ??
        new AuthError('authentication_required', 401, 'Inicia sesión para continuar.');
      return user;
    },
    signIn(credentials) {
      return operation(async () => {
        const { data, error } = await server.client.auth.signInWithPassword(credentials);
        checkOperation(error, error?.code === 'email_not_confirmed'
          ? new AuthError('email_confirmation_required', 401, 'Confirma tu correo antes de iniciar sesión.')
          : new AuthError('signin_failed', 401, 'No se pudo iniciar sesión. Revisa tus credenciales.'));
        forgetUser();
        return identity(data.user);
      });
    },
    signUp(credentials, redirectTo) {
      return operation(async () => {
        const { data, error } = await server.client.auth.signUp({
          ...credentials, options: { emailRedirectTo: redirectTo },
        });
        checkOperation(error, new AuthError('signup_failed', 400, 'No se pudo crear la cuenta.'));
        forgetUser();
        return { confirmationRequired: !data.session, user: data.user ? identity(data.user) : null };
      });
    },
    resendConfirmation(email, redirectTo) {
      return operation(async () => {
        const { error } = await server.client.auth.resend({
          type: 'signup', email, options: { emailRedirectTo: redirectTo },
        });
        checkOperation(error, new AuthError('confirmation_resend_failed', 400,
          'No se pudo solicitar el correo. Inténtalo de nuevo más tarde.'));
      });
    },
    requestPasswordReset(email, redirectTo) {
      return operation(async () => {
        const { error } = await server.client.auth.resetPasswordForEmail(email, { redirectTo });
        // Do not reveal whether an address belongs to an account.
        if (error?.code === 'user_not_found') return;
        checkOperation(error, new AuthError('recovery_failed', 400,
          'No se pudo solicitar el correo. Inténtalo de nuevo más tarde.'));
      });
    },
    updatePassword(password) {
      return operation(async () => {
        await adapter.requireUser();
        const { data, error } = await server.client.auth.updateUser({ password });
        if (error) {
          const failure = sessionFailure(error);
          if (failure) throw failure;
        }
        checkOperation(error, new AuthError('password_update_failed', 400,
          'No se pudo actualizar la contraseña. Revisa los requisitos de tu cuenta.'));
        forgetUser();
        return identity(data.user);
      });
    },
    verifyEmailLink(tokenHash, purpose) {
      return operation(async () => {
        const { error } = await server.client.auth.verifyOtp({
          token_hash: tokenHash, type: purpose === 'recovery' ? 'recovery' : 'email',
        });
        checkOperation(error, new AuthError(
          error?.code === 'otp_expired' ? 'link_expired' : 'invalid_link', 401,
          'El enlace venció, ya se usó o no es válido. Solicita uno nuevo.'));
        forgetUser();
      });
    },
    exchangeCodeForSession(code) {
      return operation(async () => {
        const { error } = await server.client.auth.exchangeCodeForSession(code);
        checkOperation(error, new AuthError('invalid_link', 401, 'No se pudo verificar el enlace.'));
        forgetUser();
      });
    },
    signOut() {
      return operation(async () => {
        const { error } = await server.client.auth.signOut({ scope: 'local' });
        if (error && !sessionFailure(error)) {
          checkOperation(error, new AuthError('signout_failed', 502, 'No se pudo cerrar la sesión.'));
        }
        checkedUser = Promise.resolve(null);
        rejectedSession = null;
      });
    },
    applyResponse: server.applyAuthResponse,
  };
  return adapter;
}
