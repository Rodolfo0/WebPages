import { ensureLocalUser } from '../../../database/d1/local-users';
import type { AuthUser } from '../domain/auth';
import { AuthError } from '../domain/auth';
import type { AuthBindings } from './config';

export async function ensureAuthUserIsLocal(bindings: AuthBindings, user: AuthUser) {
  try {
    if (!bindings.DB) throw new Error('D1 is not configured.');
    return await ensureLocalUser(bindings.DB, user);
  } catch {
    throw new AuthError(
      'local_identity_unavailable',
      503,
      'No se pudo preparar el acceso privado. Inténtalo de nuevo.',
    );
  }
}
