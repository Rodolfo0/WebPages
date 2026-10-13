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
