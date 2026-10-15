import type { AuthBindings } from './config';
import { authJson } from './http';
import { withAuthUser } from './with-user';

export async function handleAuthSession(request: Request, bindings: AuthBindings) {
  const response = await withAuthUser(request, bindings, (user) =>
    authJson({ authenticated: true, user }),
  );
  if (response.status !== 401) return response;
  const body = await response.json() as { error: string; message: string };
  return new Response(JSON.stringify({ authenticated: false, ...body }), {
    status: response.status,
    headers: response.headers,
  });
}
