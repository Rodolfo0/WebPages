import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import { createSupabaseServerClient } from '../../server/supabase-server';

vi.mock('@supabase/ssr', async (original) => {
  const actual = await original<typeof import('@supabase/ssr')>();
  return { ...actual, createServerClient: vi.fn() };
});
let cookies: CookieMethodsServer;
let cookieOptions: unknown;
beforeEach(() => {
  vi.mocked(createServerClient).mockReset().mockImplementation((_url, _key, options) => {
    cookies = options.cookies as CookieMethodsServer;
    cookieOptions = options.cookieOptions;
    return {} as ReturnType<typeof createServerClient>;
  });
});

describe('SSR cookie transport', () => {
  it('reads request cookies and preserves every cookie chunk and existing Vary entries', async () => {
    const server = createSupabaseServerClient(new Request('https://app.example.test', {
      headers: { Cookie: 'provider-session.0=old; unrelated=kept' },
    }), { SUPABASE_URL: 'https://test-project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' });
    expect(cookieOptions).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    expect(await cookies.getAll()).toEqual([
      { name: 'provider-session.0', value: 'old' }, { name: 'unrelated', value: 'kept' },
    ]);
    await cookies.setAll!([
      { name: 'provider-session.0', value: 'renewed-0', options: { path: '/', sameSite: 'lax' } },
      { name: 'provider-session.1', value: 'renewed-1', options: { path: '/', sameSite: 'lax' } },
    ], { 'Cache-Control': 'private, no-store', Expires: '0', Pragma: 'no-cache' });
    const response = server.applyAuthResponse(Response.json({ private: true }, { headers: { Vary: 'Accept', 'Set-Cookie': 'other-cookie=keep; Path=/' } }));
    expect(response.headers.getSetCookie()).toHaveLength(3);
    expect(response.headers.get('Set-Cookie')).toContain('provider-session.1=renewed-1');
    expect(response.headers.get('Vary')).toBe('Accept, Cookie');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Expires')).toBe('0');
  });
});
