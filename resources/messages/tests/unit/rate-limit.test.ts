import { describe, expect, it } from 'vitest';
import { ipBucketKey, rateLimitWindows, retryAfterSeconds } from '../../server/rate-limit';

describe('contact rate-limit keys', () => {
  it('derives a stable HMAC key that never contains the address', async () => {
    const first = await ipBucketKey('test-secret', '203.0.113.7');
    expect(first).toMatch(/^ip:[0-9a-f]{64}$/);
    expect(first).not.toContain('203.0.113.7');
    expect(await ipBucketKey('test-secret', '203.0.113.7')).toBe(first);
    expect(await ipBucketKey('other-secret', '203.0.113.7')).not.toBe(first);
    expect(await ipBucketKey('test-secret', '203.0.113.8')).not.toBe(first);
  });
});

describe('contact rate-limit windows', () => {
  const now = Date.UTC(2026, 10, 25, 10, 47, 30);

  it('aligns fixed windows for the IP and the project', () => {
    expect(rateLimitWindows(now, 'ip:abc')).toEqual([
      { bucketKey: 'ip:abc', windowMs: 600_000, windowStart: Date.UTC(2026, 10, 25, 10, 40), max: 3 },
      { bucketKey: 'ip:abc', windowMs: 86_400_000, windowStart: Date.UTC(2026, 10, 25), max: 10 },
      { bucketKey: 'project', windowMs: 3_600_000, windowStart: Date.UTC(2026, 10, 25, 10), max: 60 },
    ]);
  });

  it('keeps only the project window when no IP key is available', () => {
    expect(rateLimitWindows(now, null).map((window) => window.bucketKey)).toEqual(['project']);
  });

  it('waits until the last exceeded window closes', () => {
    const [tenMinutes, day] = rateLimitWindows(now, 'ip:abc');
    expect(retryAfterSeconds([tenMinutes], now)).toBe(150);
    expect(retryAfterSeconds([tenMinutes, day], now)).toBe((day.windowStart + day.windowMs - now) / 1000);
    expect(retryAfterSeconds([tenMinutes], tenMinutes.windowStart + tenMinutes.windowMs)).toBe(1);
  });
});
