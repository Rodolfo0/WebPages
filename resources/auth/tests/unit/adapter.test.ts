import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError } from '../../domain/auth';
import { createAuthAdapter } from '../../server/auth';
import { ensureAuthUserIsLocal } from '../../server/local-user';
import { createSupabaseServerClient } from '../../server/supabase-server';
import { withAuthUser } from '../../server/with-user';

vi.mock('../../server/local-user', () => ({ ensureAuthUserIsLocal: vi.fn() }));
vi.mock('../../server/supabase-server', () => ({ createSupabaseServerClient: vi.fn() }));

const provider = {
  getUser: vi.fn(), signOut: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(),
  resend: vi.fn(), resetPasswordForEmail: vi.fn(), updateUser: vi.fn(),
  verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn(),
};
const request = new Request('https://app.example.test/private');
const user = { id: 'user-123', email: 'user@example.test', user_metadata: { private: true }, role: 'authenticated' };

beforeEach(() => {
  for (const method of Object.values(provider)) method.mockReset();
  vi.mocked(ensureAuthUserIsLocal).mockReset().mockResolvedValue('local-user-1');
  provider.getUser.mockResolvedValue({ data: { user }, error: null });
  provider.signOut.mockResolvedValue({ error: null });
  vi.mocked(createSupabaseServerClient).mockReset().mockReturnValue({
    client: { auth: provider },
    applyAuthResponse: (response: Response) => {
      const headers = new Headers(response.headers);
      headers.append('Set-Cookie', 'provider-cookie=renewed; Path=/; HttpOnly');
      headers.set('Cache-Control', 'private, no-store');
      return new Response(response.body, { status: response.status, headers });
    },
  } as unknown as ReturnType<typeof createSupabaseServerClient>);
});

describe('internal authentication adapter', () => {
  it('projects a validated provider user and deduplicates validation within a request', async () => {
    const auth = createAuthAdapter(request, {});
    expect(await auth.getUser()).toEqual({ id: user.id, email: user.email });
    expect(await auth.requireUser()).toEqual({ id: user.id, email: user.email });
    expect(provider.getUser).toHaveBeenCalledOnce();
    await createAuthAdapter(request, {}).requireUser();
    expect(provider.getUser).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['AuthSessionMissingError', undefined, undefined, 'authentication_required'],
    ['AuthApiError', 'session_expired', 400, 'session_expired'],
    ['AuthApiError', 'refresh_token_not_found', 400, 'session_expired'],
    ['AuthApiError', 'refresh_token_already_used', 400, 'session_expired'],
    ['AuthApiError', 'bad_jwt', 403, 'session_invalid'],
    ['AuthApiError', 'session_not_found', 400, 'session_invalid'],
    ['AuthApiError', undefined, 401, 'session_invalid'],
  ])('denies %s/%s and exposes an internal error', async (name, code, status, expected) => {
    provider.getUser.mockResolvedValue({ data: { user: null }, error: { name, code, status } });
    const auth = createAuthAdapter(request, {});
    expect(await auth.getUser()).toBeNull();
    await expect(auth.requireUser()).rejects.toMatchObject({ code: expected, status: 401 });
    if (expected !== 'authentication_required') expect(provider.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('denies a user without the email required by the internal contract', async () => {
    provider.getUser.mockResolvedValue({ data: { user: { id: 'phone-user' } }, error: null });
    expect(await createAuthAdapter(request, {}).getUser()).toBeNull();
  });

  it('rejects a malformed provider identity instead of violating the internal type', async () => {
    provider.getUser.mockResolvedValue({ data: { user: { id: 42, email: user.email } }, error: null });
    expect(await createAuthAdapter(request, {}).getUser()).toBeNull();
  });

  it('keeps provider outages distinct from an unauthenticated session', async () => {
    provider.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503, name: 'AuthApiError', message: 'sensitive upstream detail' } });
    await expect(createAuthAdapter(request, {}).getUser()).rejects.toMatchObject({
      code: 'auth_provider_unavailable', status: 502,
    });
    expect(provider.signOut).not.toHaveBeenCalled();
  });

  it('maps thrown transport errors without exposing their content', async () => {
    provider.getUser.mockRejectedValue(new Error('internal token details'));
    const error = await createAuthAdapter(request, {}).requireUser().catch((error) => error);
    expect(error).toBeInstanceOf(AuthError);
    expect(error.message).not.toContain('internal token');
  });

  it('does not reuse a user after sign out', async () => {
    const auth = createAuthAdapter(request, {});
    await auth.requireUser();
    await auth.signOut();
    expect(await auth.getUser()).toBeNull();
    expect(provider.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

describe('private HTTP surfaces', () => {
  it('passes only AuthUser to a private handler and preserves renewed cookies', async () => {
    const handler = vi.fn((identity) => Response.json(identity));
    const response = await withAuthUser(request, {}, handler);
    expect(handler).toHaveBeenCalledWith({ id: user.id, email: user.email });
    expect(ensureAuthUserIsLocal).toHaveBeenCalledWith({}, { id: user.id, email: user.email });
    expect(await response.json()).toEqual({ id: user.id, email: user.email });
    expect(response.headers.get('set-cookie')).toContain('renewed');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('does not call the private handler for a rejected session and preserves cleanup cookies', async () => {
    provider.getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthApiError', code: 'bad_jwt', status: 403 } });
    const handler = vi.fn();
    const response = await withAuthUser(request, {}, handler);
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    expect(response.headers.get('set-cookie')).toContain('provider-cookie');
  });

  it('does not call a private handler when the local identity cannot be resolved', async () => {
    vi.mocked(ensureAuthUserIsLocal).mockRejectedValueOnce(new AuthError(
      'local_identity_unavailable', 503, 'No se pudo preparar el acceso privado. Inténtalo de nuevo.',
    ));
    const handler = vi.fn();
    const response = await withAuthUser(request, {}, handler);

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'local_identity_unavailable' });
    expect(handler).not.toHaveBeenCalled();
    expect(response.headers.get('set-cookie')).toContain('provider-cookie');
  });
});
