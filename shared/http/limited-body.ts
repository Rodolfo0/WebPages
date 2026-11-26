/** The request declared or streamed more bytes than the caller allows. */
export class RequestBodyTooLargeError extends Error {
  constructor() {
    super('The request body exceeds the allowed size.');
    this.name = 'RequestBodyTooLargeError';
  }
}

/** The request body stream failed before it could be read completely. */
export class RequestBodyReadError extends Error {
  constructor() {
    super('The request body could not be read.');
    this.name = 'RequestBodyReadError';
  }
}

/**
 * Reads a request body without buffering more than `maxBytes`.
 *
 * `Content-Length` is checked first, but it is only a hint: the stream is counted as it arrives and
 * cancelled as soon as it passes the limit, so a client cannot exhaust Worker memory by lying about
 * the length or by omitting it. A request without a body resolves to an empty array; callers decide
 * whether that is an error.
 */
export async function readLimitedBody(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)) {
    throw new RequestBodyTooLargeError();
  }
  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) throw new RequestBodyTooLargeError();
      chunks.push(value);
    }
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    if (error instanceof RequestBodyTooLargeError) throw error;
    throw new RequestBodyReadError();
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
