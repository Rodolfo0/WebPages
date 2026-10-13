import type { SupabaseAuthBindings } from './config';
import { createSupabaseServerClient } from './supabase-server';

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

export async function handleAuthSession(
  request: Request,
  bindings: SupabaseAuthBindings,
) {
  let serverClient: ReturnType<typeof createSupabaseServerClient>;
  try {
    serverClient = createSupabaseServerClient(request, bindings);
  } catch {
    return jsonResponse({ error: 'supabase_not_configured' }, 503);
  }

  try {
    const { data, error } = await serverClient.client.auth.getUser();

    if (error) {
      const isUnauthenticated =
        error.name === 'AuthSessionMissingError' || error.status === 401;
      return serverClient.applyAuthResponse(
        jsonResponse(
          { authenticated: false },
          isUnauthenticated ? 401 : 502,
        ),
      );
    }

    if (!data.user) {
      return serverClient.applyAuthResponse(
        jsonResponse({ authenticated: false }, 401),
      );
    }

    return serverClient.applyAuthResponse(
      jsonResponse(
        {
          authenticated: true,
          user: { id: data.user.id, email: data.user.email ?? null },
        },
        200,
      ),
    );
  } catch {
    return serverClient.applyAuthResponse(
      jsonResponse({ error: 'auth_provider_unavailable' }, 502),
    );
  }
}
