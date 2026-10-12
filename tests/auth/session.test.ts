import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseServerClient } from '../../lib/auth/supabase-server';
import { handleAuthSession } from '../../lib/auth/session';

vi.mock('../../lib/auth/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

describe('GET /api/auth/session handler', () => {
  const request = new Request('https://app.example.test/api/auth/session', {
    headers: { cookie: 'sb-test-auth-token=opaque-session-cookie' },
  });
  const bindings = {
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key',
  };
  const getUser = vi.fn();
  const applyAuthResponse = vi.fn((response: Response) => response);

  beforeEach(() => {
    getUser.mockReset();
    applyAuthResponse.mockClear();
    vi.mocked(createSupabaseServerClient).mockReset();
    vi.mocked(createSupabaseServerClient).mockReturnValue({
      client: { auth: { getUser } },
      applyAuthResponse,
    } as unknown as ReturnType<typeof createSupabaseServerClient>);
  });

  it('rejects a request without a valid session and does not return tokens', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthSessionMissingError', status: null },
    });

    const response = await handleAuthSession(request, bindings);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ authenticated: false });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(createSupabaseServerClient).toHaveBeenCalledWith(request, bindings);
    expect(applyAuthResponse).toHaveBeenCalledOnce();
  });

  it('returns only the user identity when the server validates a session', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.test' } },
      error: null,
    });

    const response = await handleAuthSession(request, bindings);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authenticated: true,
      user: { id: 'user-123', email: 'test@example.test' },
    });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('returns a setup error when Supabase bindings are missing', async () => {
    vi.mocked(createSupabaseServerClient).mockImplementationOnce(() => {
      throw new Error('Supabase configuration is incomplete.');
    });

    const response = await handleAuthSession(new Request(request.url), {});

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'supabase_not_configured' });
    expect(createSupabaseServerClient).toHaveBeenCalledOnce();
  });
});
