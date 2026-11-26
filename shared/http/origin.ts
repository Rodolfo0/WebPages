/**
 * Checks that a state-changing request comes from this application's own origin.
 *
 * With `required`, a missing `Origin` header is rejected; this is the mode for mutations that must
 * also refuse HTTP clients outside a browser. Without it, a request lacking `Origin` is accepted
 * unless the browser marks it as cross-site through `Sec-Fetch-Site`.
 */
export function isSameOrigin(request: Request, required = false) {
  const origin = request.headers.get('origin');
  if (!origin) return !required && request.headers.get('sec-fetch-site') !== 'cross-site';
  return origin === new URL(request.url).origin;
}
