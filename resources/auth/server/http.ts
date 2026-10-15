import { AuthError } from '../domain/auth';

export function authJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'private, no-store', Pragma: 'no-cache', Vary: 'Cookie',
  } });
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return authJson({ error: error.code, message: error.message }, error.status);
  }
  return authJson({
    error: 'auth_provider_unavailable', message: 'No se pudo completar la solicitud. Inténtalo de nuevo.',
  }, 502);
}

export function isSameOrigin(request: Request, required = false) {
  const origin = request.headers.get('origin');
  if (!origin) return !required && request.headers.get('sec-fetch-site') !== 'cross-site';
  return origin === new URL(request.url).origin;
}
