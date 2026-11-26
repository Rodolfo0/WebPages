import { FORM_RATE_LIMITS } from '../domain/forms';

export type RateLimitWindow = {
  bucketKey: string;
  windowMs: number;
  windowStart: number;
  max: number;
};

const textEncoder = new TextEncoder();

/**
 * Derives the per-IP bucket key with HMAC-SHA256.
 *
 * A plain hash would not protect the address: the IPv4 space is small enough to invert by brute
 * force. With a secret key the stored value cannot be linked back to an address, and rotating the
 * secret simply starts fresh windows.
 */
export async function ipBucketKey(secret: string, ip: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, textEncoder.encode(ip)));
  return `ip:${Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Lists the windows one submission consumes.
 *
 * Without an IP bucket key (the secret is not configured) only the per-project window applies:
 * nothing derived from the address is stored, and legitimate messages are still accepted.
 */
export function rateLimitWindows(now: number, ipKey: string | null): RateLimitWindow[] {
  return FORM_RATE_LIMITS.flatMap((limit) => {
    const bucketKey = limit.scope === 'project' ? 'project' : ipKey;
    if (!bucketKey) return [];
    return [{
      bucketKey,
      windowMs: limit.windowMs,
      windowStart: Math.floor(now / limit.windowMs) * limit.windowMs,
      max: limit.max,
    }];
  });
}

/** Seconds until every exceeded window has closed; at least one. */
export function retryAfterSeconds(exceeded: RateLimitWindow[], now: number) {
  const reopensAt = Math.max(...exceeded.map((window) => window.windowStart + window.windowMs));
  return Math.max(1, Math.ceil((reopensAt - now) / 1000));
}
