import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseServerClient } from '../../server/supabase-server';
import { handleAuthResendSignupConfirmation } from '../../server/actions';

vi.mock('../../server/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

describe('POST /api/auth/resend-confirmation handler', () => {
  const bindings = {
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key',
  };
  const resend = vi.fn();
  const applyAuthResponse = vi.fn((response: Response) => response);

  beforeEach(() => {
    resend.mockReset().mockResolvedValue({ error: null });
    applyAuthResponse.mockClear();
    vi.mocked(createSupabaseServerClient).mockReset().mockReturnValue({
      client: { auth: { resend } },
      applyAuthResponse,
    } as unknown as ReturnType<typeof createSupabaseServerClient>);
  });

  it('requests a signup link for the current application origin', async () => {
    const request = new Request('http://localhost:5180/api/auth/resend-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '  pending@example.test  ' }),
    });

    const response = await handleAuthResendSignupConfirmation(request, bindings);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true });
    expect(resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'pending@example.test',
      options: { emailRedirectTo: 'http://localhost:5180/auth/confirm/start' },
    });
    expect(applyAuthResponse).toHaveBeenCalledOnce();
  });

  it('rejects a request without an email', async () => {
    const request = new Request('http://localhost:5180/api/auth/resend-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await handleAuthResendSignupConfirmation(request, bindings);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'email_required' });
    expect(resend).not.toHaveBeenCalled();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
