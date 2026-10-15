import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleAuthEmailConfirmationStart, handleAuthEmailConfirmation,
  handleAuthPasswordRecoveryStart, handleAuthPasswordRecoveryVerification,
} from '../../server/callback';
import { createSupabaseServerClient } from '../../server/supabase-server';

vi.mock('../../server/supabase-server', () => ({ createSupabaseServerClient: vi.fn() }));
const verifyOtp = vi.fn();
beforeEach(() => {
  verifyOtp.mockReset().mockResolvedValue({ data: {}, error: null });
  vi.mocked(createSupabaseServerClient).mockReset().mockReturnValue({ client: { auth: { verifyOtp } },
    applyAuthResponse: (response: Response) => {
      const headers = new Headers(response.headers);
      headers.append('Set-Cookie', 'provider-session=verified; Path=/');
      return new Response(response.body, { status: response.status, headers });
    },
  } as unknown as ReturnType<typeof createSupabaseServerClient>);
});

function verification(path: string, cookie: string, state: string, origin = 'https://app.example.test') {
  const body = new URLSearchParams({ token_hash: 'one-time-test-hash', state });
  return new Request('https://app.example.test' + path + '/verify', {
    method: 'POST', headers: { cookie, Origin: origin }, body,
  });
}

describe('explicit email link verification', () => {
  it.each([
    ['/auth/confirm', handleAuthEmailConfirmationStart, handleAuthEmailConfirmation, 'email', 'confirmed'],
    ['/auth/recovery', handleAuthPasswordRecoveryStart, handleAuthPasswordRecoveryVerification, 'recovery', 'recovery'],
  ] as const)('verifies %s only after an explicit POST in the same browser', async (path, start, verify, type, result) => {
    const response = start(new Request('https://app.example.test' + path + '/start?token_hash=one-time-test-hash'));
    expect(response.status).toBe(303);
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    const destination = new URL(response.headers.get('Location')!);
    expect(destination.pathname).toBe(path);
    const cookie = response.headers.get('Set-Cookie')!;
    expect(cookie).toContain('HttpOnly; SameSite=Lax; Secure');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    const verified = await verify(verification(path, cookie.split(';')[0], destination.searchParams.get('state')!), {});
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'one-time-test-hash', type });
    const finalDestination = new URL(verified.headers.get('Location')!);
    expect(finalDestination.searchParams.get('auth')).toBe(result);
    expect(finalDestination.searchParams.has('token_hash')).toBe(false);
    expect(verified.headers.getSetCookie()).toHaveLength(2);
    expect(verified.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  it('rejects a mismatched or cross-origin recovery state before verifying the token', async () => {
    for (const request of [
      verification('/auth/recovery', 'auth-recovery-state=expected', 'other'),
      verification('/auth/recovery', 'auth-recovery-state=expected', 'expected', 'https://untrusted.example.test'),
      verification('/auth/recovery', 'auth-confirmation-state=expected', 'expected'),
    ]) {
      const response = await handleAuthPasswordRecoveryVerification(request, {});
      expect(new URL(response.headers.get('Location')!).searchParams.get('auth')).toBe('recovery_error');
    }
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('returns an expired-link state and clears the temporary cookie', async () => {
    verifyOtp.mockResolvedValue({ error: { name: 'AuthApiError', code: 'otp_expired', status: 403 } });
    const response = await handleAuthPasswordRecoveryVerification(
      verification('/auth/recovery', 'auth-recovery-state=expected', 'expected'), {},
    );
    expect(new URL(response.headers.get('Location')!).searchParams.get('auth')).toBe('recovery_link_expired');
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
});
