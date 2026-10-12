import { describe, expect, it } from 'vitest';
import { getSupabaseAuthConfig } from '../../server/config';

describe('Supabase Auth configuration', () => {
  it('requires the project URL and publishable key', () => {
    expect(() => getSupabaseAuthConfig({})).toThrow(
      'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY',
    );
  });

  it('accepts a hosted project URL and publishable key', () => {
    expect(
      getSupabaseAuthConfig({
        SUPABASE_URL: 'https://test-project.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key',
      }),
    ).toEqual({
      url: 'https://test-project.supabase.co',
      publishableKey: 'sb_publishable_test_key',
    });
  });

  it('allows the local Supabase CLI URL over HTTP', () => {
    expect(
      getSupabaseAuthConfig({
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local_test',
      }).url,
    ).toBe('http://127.0.0.1:54321');
  });
});
