import type { SupabaseAuthBindings } from './config';
import { createSupabaseServerClient } from './supabase-server';

type Credentials = {
  email: string;
  password: string;
};

function jsonResponse(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      Pragma: 'no-cache',
      Vary: 'Cookie',
    },
  });
}

async function readCredentials(request: Request): Promise<Credentials | null> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') return null;

    const { email, password } = body as Record<string, unknown>;
    if (
      typeof email !== 'string' ||
      !email.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
      return null;
    }

    return { email: email.trim(), password };
  } catch {
    return null;
  }
}

function createClient(request: Request, bindings: SupabaseAuthBindings) {
  try {
    return createSupabaseServerClient(request, bindings);
  } catch {
    return null;
  }
}

export async function handleAuthSignUp(
  request: Request,
  bindings: SupabaseAuthBindings,
) {
  const credentials = await readCredentials(request);
  if (!credentials) {
    return jsonResponse({ error: 'email_and_password_required' }, 400);
  }

  const server = createClient(request, bindings);
  if (!server) return jsonResponse({ error: 'supabase_not_configured' }, 503);

  try {
    const emailRedirectTo = new URL('/auth/callback', request.url).toString();
    const { data, error } = await server.client.auth.signUp({
      ...credentials,
      options: { emailRedirectTo },
    });

    if (error) {
      return server.applyAuthResponse(
        jsonResponse({ error: 'signup_failed', message: error.message }, 400),
      );
    }

    return server.applyAuthResponse(
      jsonResponse(
        {
          confirmationRequired: !data.session,
          user: data.user
            ? { id: data.user.id, email: data.user.email ?? null }
            : null,
        },
        200,
      ),
    );
  } catch {
    return server.applyAuthResponse(
      jsonResponse({ error: 'auth_provider_unavailable' }, 502),
    );
  }
}

export async function handleAuthSignIn(
  request: Request,
  bindings: SupabaseAuthBindings,
) {
  const credentials = await readCredentials(request);
  if (!credentials) {
    return jsonResponse({ error: 'email_and_password_required' }, 400);
  }

  const server = createClient(request, bindings);
  if (!server) return jsonResponse({ error: 'supabase_not_configured' }, 503);

  try {
    const { data, error } = await server.client.auth.signInWithPassword(
      credentials,
    );

    if (error) {
      return server.applyAuthResponse(
        jsonResponse({ error: 'signin_failed', message: error.message }, 401),
      );
    }

    return server.applyAuthResponse(
      jsonResponse(
        {
          authenticated: true,
          user: { id: data.user.id, email: data.user.email ?? null },
        },
        200,
      ),
    );
  } catch {
    return server.applyAuthResponse(
      jsonResponse({ error: 'auth_provider_unavailable' }, 502),
    );
  }
}

export async function handleAuthSignOut(
  request: Request,
  bindings: SupabaseAuthBindings,
) {
  const server = createClient(request, bindings);
  if (!server) return jsonResponse({ error: 'supabase_not_configured' }, 503);

  try {
    const { error } = await server.client.auth.signOut({ scope: 'local' });
    if (error) {
      return server.applyAuthResponse(
        jsonResponse({ error: 'signout_failed', message: error.message }, 502),
      );
    }

    return server.applyAuthResponse(jsonResponse({ authenticated: false }, 200));
  } catch {
    return server.applyAuthResponse(
      jsonResponse({ error: 'auth_provider_unavailable' }, 502),
    );
  }
}
