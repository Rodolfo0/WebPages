import type { AuthAdapter, AuthUser } from '../domain/auth';
import { createAuthAdapter } from './auth';
import type { AuthBindings } from './config';
import { authErrorResponse } from './http';

// Private HTTP surfaces receive only the internal identity and retain cookies.
export async function withAuthUser(
  request: Request,
  bindings: AuthBindings,
  respond: (user: AuthUser) => Response | Promise<Response>,
) {
  let auth: AuthAdapter;
  try {
    auth = createAuthAdapter(request, bindings);
  } catch (error) {
    return authErrorResponse(error);
  }
  let user: AuthUser;
  try {
    user = await auth.requireUser();
  } catch (error) {
    return auth.applyResponse(authErrorResponse(error));
  }
  return auth.applyResponse(await respond(user));
}
