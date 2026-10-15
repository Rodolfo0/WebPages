import type { AuthAdapter } from '../domain/auth';
import type { AuthBindings } from './config';
import { createSupabaseAuthAdapter } from './supabase-adapter';

// This is the only selection point for the authentication provider.
export function createAuthAdapter(request: Request, bindings: AuthBindings): AuthAdapter {
  return createSupabaseAuthAdapter(request, bindings);
}
