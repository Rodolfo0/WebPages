export interface AuthBindings {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
}

export function getSupabaseAuthConfig(bindings: AuthBindings) {
  const url = bindings.SUPABASE_URL?.trim();
  const publishableKey = bindings.SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error(
      'Supabase Auth requires SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('SUPABASE_URL must be a valid URL.');
  }

  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(
    parsedUrl.hostname,
  );
  if (parsedUrl.protocol !== 'https:' && !isLocalhost) {
    throw new Error('SUPABASE_URL must use HTTPS outside localhost.');
  }

  return { url, publishableKey };
}
