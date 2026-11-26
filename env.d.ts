declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
    /** HMAC key for contact form rate-limit buckets; secret, set through SECRETS_JSON. */
    FORM_RATE_LIMIT_SECRET?: string;
  }
}
