import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from '@supabase/ssr';
import { getSupabaseAuthConfig, type AuthBindings } from './config';

export function createSupabaseServerClient(
  request: Request,
  bindings: AuthBindings,
) {
  const { url, publishableKey } = getSupabaseAuthConfig(bindings);
  const pendingCookies = new Map<string, string>();
  const pendingHeaders = new Headers();

  const client = createServerClient(url, publishableKey, {
    // The browser uses our HTTP routes, not a browser Supabase client.
    cookieOptions: {
      httpOnly: true,
      secure: new URL(request.url).protocol === 'https:',
      sameSite: 'lax',
      path: '/',
    },
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('cookie') ?? '');
      },
      setAll(cookiesToSet, cacheHeaders) {
        for (const { name, value, options } of cookiesToSet) {
          pendingCookies.set(
            name,
            serializeCookieHeader(name, value, options),
          );
        }

        for (const [name, value] of Object.entries(cacheHeaders)) {
          pendingHeaders.set(name, value);
        }
      },
    },
  });

  function applyAuthResponse(response: Response) {
    const headers = new Headers(response.headers);

    pendingHeaders.forEach((value, name) => headers.set(name, value));
    for (const cookie of pendingCookies.values()) {
      headers.append('Set-Cookie', cookie);
    }

    headers.set('Cache-Control', 'private, no-store');
    headers.set('Pragma', 'no-cache');
    const vary = new Set(
      (headers.get('Vary') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
    );
    if (!vary.has('*') && ![...vary].some((value) => value.toLowerCase() === 'cookie')) vary.add('Cookie');
    headers.set('Vary', [...vary].join(', '));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return { client, applyAuthResponse };
}
