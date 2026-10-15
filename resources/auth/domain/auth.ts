export type AuthUser = Readonly<{ id: string; email: string }>;
export type AuthCredentials = { email: string; password: string };
export type AuthEmailLinkPurpose = 'confirmation' | 'recovery';
export type AuthSignUpResult = { confirmationRequired: boolean; user: AuthUser | null };

export type AuthErrorCode =
  | 'auth_not_configured'
  | 'authentication_required'
  | 'session_expired'
  | 'session_invalid'
  | 'auth_provider_unavailable'
  | 'signin_failed'
  | 'email_confirmation_required'
  | 'signup_failed'
  | 'confirmation_resend_failed'
  | 'signout_failed'
  | 'recovery_failed'
  | 'password_update_failed'
  | 'link_expired'
  | 'invalid_link';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// One adapter belongs to one request. Always apply its cookies to the response.
export interface AuthAdapter {
  getUser(): Promise<AuthUser | null>;
  requireUser(): Promise<AuthUser>;
  signIn(credentials: AuthCredentials): Promise<AuthUser>;
  signUp(credentials: AuthCredentials, redirectTo: string): Promise<AuthSignUpResult>;
  resendConfirmation(email: string, redirectTo: string): Promise<void>;
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  updatePassword(password: string): Promise<AuthUser>;
  verifyEmailLink(tokenHash: string, purpose: AuthEmailLinkPurpose): Promise<void>;
  exchangeCodeForSession(code: string): Promise<void>;
  signOut(): Promise<void>;
  applyResponse(response: Response): Response;
}
