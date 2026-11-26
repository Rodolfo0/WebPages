import { describe, expect, it } from 'vitest';
import { isSameOrigin, readLimitedBody, RequestBodyReadError, RequestBodyTooLargeError } from '..';

function streamedRequest(chunks: Uint8Array[], headers: Record<string, string> = {}) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Request('https://app.example.test/api', { method: 'POST', headers, body, duplex: 'half' } as RequestInit);
}

describe('readLimitedBody', () => {
  it('concatenates the streamed chunks within the limit', async () => {
    const body = await readLimitedBody(streamedRequest([new Uint8Array([1, 2]), new Uint8Array([3])]), 3);
    expect([...body]).toEqual([1, 2, 3]);
  });

  it('rejects a declared length over the limit before reading', async () => {
    await expect(readLimitedBody(streamedRequest([], { 'content-length': '11' }), 10))
      .rejects.toBeInstanceOf(RequestBodyTooLargeError);
    await expect(readLimitedBody(streamedRequest([], { 'content-length': 'abc' }), 10))
      .rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it('stops a stream that passes the limit even without a declared length', async () => {
    await expect(readLimitedBody(streamedRequest([new Uint8Array(6), new Uint8Array(6)]), 10))
      .rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it('reports a failing stream as a read error', async () => {
    const body = new ReadableStream<Uint8Array>({ pull(controller) { controller.error(new Error('reset')); } });
    const request = new Request('https://app.example.test/api', { method: 'POST', body, duplex: 'half' } as RequestInit);
    await expect(readLimitedBody(request, 10)).rejects.toBeInstanceOf(RequestBodyReadError);
  });

  it('returns an empty body for a request without one', async () => {
    const body = await readLimitedBody(new Request('https://app.example.test/api'), 10);
    expect(body.byteLength).toBe(0);
  });
});

describe('isSameOrigin', () => {
  const url = 'https://app.example.test/api';

  it('accepts the application origin and rejects any other', () => {
    expect(isSameOrigin(new Request(url, { headers: { Origin: 'https://app.example.test' } }), true)).toBe(true);
    expect(isSameOrigin(new Request(url, { headers: { Origin: 'https://evil.example.test' } }), true)).toBe(false);
  });

  it('requires the header only in strict mode', () => {
    expect(isSameOrigin(new Request(url), true)).toBe(false);
    expect(isSameOrigin(new Request(url))).toBe(true);
    expect(isSameOrigin(new Request(url, { headers: { 'Sec-Fetch-Site': 'cross-site' } }))).toBe(false);
  });
});
