import { expect, test } from '@playwright/test';

test('email callback route is available in the Cloudflare Worker', async ({ request }) => {
  const response = await request.get('/auth/callback', { maxRedirects: 0 });

  expect(response.status()).toBe(302);
  const destination = new URL(response.headers().location);
  expect(destination.pathname).toBe('/');
  expect(destination.searchParams.get('auth')).toBe('callback_error');
});

test('expired Supabase confirmation links return a resend state', async ({ request }) => {
  const response = await request.get(
    '/auth/callback?error=access_denied&error_code=otp_expired&error_description=expired',
    { maxRedirects: 0 },
  );

  expect(response.status()).toBe(302);
  const destination = new URL(response.headers().location);
  expect(destination.pathname).toBe('/');
  expect(destination.searchParams.get('auth')).toBe('link_expired');
});

test('Cloudflare Worker reaches Supabase Auth through the server route', async ({ request }) => {
  const response = await request.post('/api/auth/login', {
    data: {
      email: 'invalid-user-that-does-not-exist@example.test',
      password: 'invalid-test-password',
    },
  });

  expect(response.status()).toBe(401);
  expect(response.headers()['cache-control']).toContain('private');
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(await response.json()).toMatchObject({ error: 'signin_failed' });
});

test('private session and password mutation reject an absent session', async ({ request }) => {
  const session = await request.get('/api/auth/session');
  expect(session.status()).toBe(401);
  expect(await session.json()).toMatchObject({ authenticated: false, error: 'authentication_required' });
  const password = await request.post('/api/auth/password', {
    headers: { Origin: 'http://127.0.0.1:5180' }, data: { password: 'unused-test-password' },
  });
  expect(password.status()).toBe(401);
  expect(await password.json()).toMatchObject({ error: 'authentication_required' });
});

test('recovery link start prepares state without consuming the one-time token', async ({ request }) => {
  const start = await request.get('/auth/recovery/start?token_hash=invalid-test-hash', { maxRedirects: 0 });
  expect(start.status()).toBe(303);
  const destination = new URL(start.headers().location);
  expect(destination.pathname).toBe('/auth/recovery');
  expect(destination.searchParams.get('state')).toBeTruthy();
  expect(start.headers()['set-cookie']).toContain('auth-recovery-state=');
  const denied = await request.post('/auth/recovery/verify', {
    headers: { Origin: 'http://127.0.0.1:5180' },
    form: { token_hash: 'invalid-test-hash', state: 'wrong-browser-state' }, maxRedirects: 0,
  });
  expect(denied.status()).toBe(303);
  expect(new URL(denied.headers().location).searchParams.get('auth')).toBe('recovery_error');
});
