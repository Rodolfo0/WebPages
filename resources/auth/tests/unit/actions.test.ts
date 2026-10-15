import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleAuthSignIn, handleAuthSignUp, handleAuthSignOut,
  handleAuthPasswordRecovery, handleAuthPasswordUpdate,
} from '../../server/actions';
import { createSupabaseServerClient } from '../../server/supabase-server';

vi.mock('../../server/supabase-server', () => ({ createSupabaseServerClient: vi.fn() }));
const user = { id: 'user-1', email: 'user@example.test', role: 'authenticated', user_metadata: { private: true } };
const provider = {
  getUser: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(), updateUser: vi.fn(),
};
function post(path: string, body: unknown, origin = 'https://app.example.test') {
  return new Request('https://app.example.test' + path, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
  });
}
beforeEach(() => {
  for (const method of Object.values(provider)) method.mockReset();
  provider.getUser.mockResolvedValue({ data: { user }, error: null });
  provider.signOut.mockResolvedValue({ error: null });
  vi.mocked(createSupabaseServerClient).mockReset().mockReturnValue({ client: { auth: provider },
    applyAuthResponse: (response: Response) => {
      const headers = new Headers(response.headers);
      headers.append('Set-Cookie', 'session=managed-by-sdk; Path=/');
      return new Response(response.body, { status: response.status, headers });
    },
  } as unknown as ReturnType<typeof createSupabaseServerClient>);
});

describe('authentication flows through the internal adapter', () => {
  it('registers with the confirmation URL and projects identity without returning a session', async () => {
    provider.signUp.mockResolvedValue({ data: { user, session: null }, error: null });
    const response = await handleAuthSignUp(post('/api/auth/signup', { email: ' user@example.test ', password: 'test-password' }), {});
    expect(provider.signUp).toHaveBeenCalledWith({ email: user.email, password: 'test-password',
      options: { emailRedirectTo: 'https://app.example.test/auth/confirm/start' },
    });
    expect(await response.json()).toEqual({ confirmationRequired: true, user: { id: user.id, email: user.email } });
    expect(response.headers.get('Set-Cookie')).toContain('managed-by-sdk');
  });

  it('signs in and out without exposing provider objects or tokens', async () => {
    provider.signInWithPassword.mockResolvedValue({ data: { user, session: { access_token: 'never-return-this' } }, error: null });
    const login = await handleAuthSignIn(post('/api/auth/login', { email: user.email, password: 'test-password' }), {});
    expect(await login.json()).toEqual({ authenticated: true, user: { id: user.id, email: user.email } });
    const logout = await handleAuthSignOut(post('/api/auth/logout', {}), {});
    expect(await logout.json()).toEqual({ authenticated: false });
    expect(logout.headers.get('Set-Cookie')).toContain('session=');
  });

  it.each([null, { name: 'AuthApiError', code: 'user_not_found', status: 400 }])(
    'returns the same recovery response for existing and unknown accounts (%s)', async (error) => {
      provider.resetPasswordForEmail.mockResolvedValue({ data: {}, error });
      const response = await handleAuthPasswordRecovery(post('/api/auth/password/recover', { email: ' account@example.test ' }), {});
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ sent: true });
      expect(provider.resetPasswordForEmail).toHaveBeenCalledWith('account@example.test', {
        redirectTo: 'https://app.example.test/auth/recovery/start',
      });
    },
  );

  it('requires a validated session before updating a password', async () => {
    provider.updateUser.mockResolvedValue({ data: { user }, error: null });
    const response = await handleAuthPasswordUpdate(post('/api/auth/password', { password: 'new-test-password' }), {});
    expect(provider.getUser).toHaveBeenCalledOnce();
    expect(provider.updateUser).toHaveBeenCalledWith({ password: 'new-test-password' });
    expect(await response.json()).toEqual({ updated: true, user: { id: user.id, email: user.email } });
  });

  it('exposes a provider-neutral confirmation state when login requires a verified email', async () => {
    provider.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { status: 400, code: 'email_not_confirmed', message: 'provider detail' },
    });
    const response = await handleAuthSignIn(post('/api/auth/login', { email: user.email, password: 'test-password' }), {});
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: 'email_confirmation_required', message: 'Confirma tu correo antes de iniciar sesión.',
    });
  });

  it('rejects an expired session before changing credentials', async () => {
    provider.getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthApiError', code: 'session_expired', status: 400 } });
    const response = await handleAuthPasswordUpdate(post('/api/auth/password', { password: 'new-test-password' }), {});
    expect(response.status).toBe(401);
    expect(provider.updateUser).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ error: 'session_expired' });
  });

  it('hides upstream failure details and retains SDK cookies', async () => {
    provider.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { status: 400, message: 'upstream private detail' } });
    const response = await handleAuthSignIn(post('/api/auth/login', { email: user.email, password: 'wrong' }), {});
    expect(response.status).toBe(401);
    expect(JSON.stringify(await response.json())).not.toContain('upstream private detail');
    expect(response.headers.get('Set-Cookie')).toContain('session=');
  });

  it.each([handleAuthSignOut, handleAuthPasswordUpdate])('blocks cross-origin account mutations', async (handler) => {
    const response = await handler(post('/api/auth/password', { password: 'new-test-password' }, 'https://untrusted.example.test'), {});
    expect(response.status).toBe(403);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it('requires Origin for a cookie-authenticated password mutation', async () => {
    const request = post('/api/auth/password', { password: 'new-test-password' });
    request.headers.delete('Origin');
    const response = await handleAuthPasswordUpdate(request, {});
    expect(response.status).toBe(403);
    expect(provider.updateUser).not.toHaveBeenCalled();
  });
});
