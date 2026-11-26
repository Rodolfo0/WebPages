import { describe, expect, it, vi } from 'vitest';
import { handleCreateFormSubmission } from '../../server';

const ORIGIN = 'https://app.example.test';
const ENDPOINT = `${ORIGIN}/api/sites/mi-portafolio/messages`;
const valid = { name: 'Ana López', email: 'ana@example.test', message: 'Hola, me interesa tu trabajo.' };

type FakeStatement = { sql: string; bindings: unknown[] };

function publishedDocument(contactProps: Record<string, unknown> = { formEnabled: true, hidden: false }) {
  return JSON.stringify({ pages: [{ blocks: [{ type: 'hero', props: {} }, { type: 'contact', props: contactProps }] }] });
}

function fakeDatabase(options: {
  site?: { projectId: string; documentJson: string } | null;
  counts?: number[];
  inserted?: boolean;
  failBatch?: boolean;
} = {}) {
  const site = options.site === undefined
    ? { projectId: 'project-1', documentJson: publishedDocument() }
    : options.site;
  const counts = [...(options.counts ?? [])];
  const batches: FakeStatement[][] = [];
  const queries: FakeStatement[] = [];

  const database = {
    prepare: vi.fn((sql: string) => {
      const statement = {
        sql,
        bindings: [] as unknown[],
        bind(...values: unknown[]) {
          statement.bindings = values;
          return statement;
        },
        first: vi.fn(async () => {
          queries.push(statement);
          return site;
        }),
      };
      return statement;
    }),
    batch: vi.fn(async (statements: FakeStatement[]) => {
      if (options.failBatch) throw new Error('D1_ERROR: internal detail');
      batches.push(statements);
      return statements.map((statement) => {
        if (statement.sql.includes('RETURNING count')) return { results: [{ count: counts.shift() ?? 1 }], meta: {} };
        if (statement.sql.includes('INSERT INTO form_submissions')) {
          return { results: [], meta: { changes: options.inserted === false ? 0 : 1 } };
        }
        return { results: [], meta: { changes: 0 } };
      });
    }),
  };

  return { db: database as unknown as D1Database, batches, queries };
}

function contactRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request(ENDPOINT, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const bindings = (db: D1Database, secret: string | undefined = 'test-secret') => ({ DB: db, FORM_RATE_LIMIT_SECRET: secret });

describe('public contact submission route', () => {
  it('stores a valid message for the published project', async () => {
    const { db, batches, queries } = fakeDatabase();

    const response = await handleCreateFormSubmission(contactRequest({ ...valid, name: '  Ana López ' }), bindings(db), 'mi-portafolio');

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ ok: true });

    expect(queries[0].sql).toContain('project.published_version_id');
    expect(queries[0].sql).toContain("project.status <> 'archived'");
    expect(queries[0].bindings).toEqual(['mi-portafolio']);

    const insert = batches[0].find((statement) => statement.sql.includes('INSERT INTO form_submissions'))!;
    expect(insert.bindings.slice(1, 5)).toEqual(['project-1', 'Ana López', valid.email, valid.message]);
  });

  it('answers a filled honeypot like a stored message without storing it', async () => {
    const { db, batches } = fakeDatabase();

    const response = await handleCreateFormSubmission(contactRequest({ ...valid, website: 'https://spam.test' }), bindings(db), 'mi-portafolio');

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(batches[0].some((statement) => statement.sql.includes('INSERT INTO form_submissions'))).toBe(false);
    expect(batches[0].filter((statement) => statement.sql.includes('RETURNING count'))).toHaveLength(3);
  });

  it('rejects a sender over the limit with Retry-After', async () => {
    const { db } = fakeDatabase({ counts: [4, 4, 4], inserted: false });

    const response = await handleCreateFormSubmission(contactRequest(valid), bindings(db), 'mi-portafolio');

    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await response.json()).toMatchObject({ error: 'rate_limited' });
  });

  it('keys the IP windows with an HMAC and never binds the raw address', async () => {
    const { db, batches } = fakeDatabase();
    await handleCreateFormSubmission(contactRequest(valid), bindings(db), 'mi-portafolio');

    const counters = batches[0].filter((statement) => statement.sql.includes('RETURNING count'));
    expect(counters.map((statement) => statement.bindings[1])).toEqual([
      expect.stringMatching(/^ip:[0-9a-f]{64}$/),
      expect.stringMatching(/^ip:[0-9a-f]{64}$/),
      'project',
    ]);
    expect(JSON.stringify(batches)).not.toContain('203.0.113.7');
  });

  it('falls back to the project window when the secret is not configured', async () => {
    const { db, batches } = fakeDatabase();
    const response = await handleCreateFormSubmission(contactRequest(valid), { DB: db }, 'mi-portafolio');

    expect(response.status).toBe(201);
    const counters = batches[0].filter((statement) => statement.sql.includes('RETURNING count'));
    expect(counters.map((statement) => statement.bindings[1])).toEqual(['project']);
  });

  it.each([
    ['an unknown slug', { site: null }],
    ['a snapshot without an enabled form', { site: { projectId: 'project-1', documentJson: publishedDocument({ formEnabled: false }) } }],
    ['a hidden contact block', { site: { projectId: 'project-1', documentJson: publishedDocument({ formEnabled: true, hidden: true }) } }],
    ['a snapshot published before the form existed', { site: { projectId: 'project-1', documentJson: publishedDocument({}) } }],
  ])('returns the same 404 for %s', async (_case, options) => {
    const { db, batches } = fakeDatabase(options);

    const response = await handleCreateFormSubmission(contactRequest(valid), bindings(db), 'mi-portafolio');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'site_not_found', message: 'Este sitio no recibe mensajes.' });
    expect(batches).toHaveLength(0);
  });

  it('does not query D1 for a malformed slug', async () => {
    const { db } = fakeDatabase();
    const response = await handleCreateFormSubmission(contactRequest(valid), bindings(db), '../Otro_Proyecto');
    expect(response.status).toBe(404);
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('requires the application origin', async () => {
    const { db } = fakeDatabase();
    const missing = new Request(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid) });
    expect((await handleCreateFormSubmission(missing, bindings(db), 'mi-portafolio')).status).toBe(403);
    const foreign = contactRequest(valid, { Origin: 'https://evil.example.test' });
    expect((await handleCreateFormSubmission(foreign, bindings(db), 'mi-portafolio')).status).toBe(403);
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('rejects other content types and oversized bodies', async () => {
    const { db } = fakeDatabase();
    const form = contactRequest('name=Ana', { 'Content-Type': 'application/x-www-form-urlencoded' });
    expect((await handleCreateFormSubmission(form, bindings(db), 'mi-portafolio')).status).toBe(415);

    const large = contactRequest({ ...valid, message: 'a'.repeat(20 * 1024) });
    const response = await handleCreateFormSubmission(large, bindings(db), 'mi-portafolio');
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: 'payload_too_large' });
  });

  it('returns field errors for invalid input and a generic error for invalid JSON', async () => {
    const { db } = fakeDatabase();
    const invalid = await handleCreateFormSubmission(contactRequest({ ...valid, email: 'ana@' }), bindings(db), 'mi-portafolio');
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({
      error: 'form_invalid',
      message: 'Revisa los campos del formulario.',
      fields: { email: 'Escribe un email válido.' },
    });

    const malformed = await handleCreateFormSubmission(contactRequest('{"name":'), bindings(db), 'mi-portafolio');
    expect(malformed.status).toBe(400);
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('hides storage failures behind a generic 503', async () => {
    const { db } = fakeDatabase({ failBatch: true });
    const response = await handleCreateFormSubmission(contactRequest(valid), bindings(db), 'mi-portafolio');
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).toContain('messages_unavailable');
    expect(text).not.toContain('internal detail');

    const unavailable = await handleCreateFormSubmission(contactRequest(valid), {}, 'mi-portafolio');
    expect(unavailable.status).toBe(503);
  });

  it('never returns project identifiers', async () => {
    const { db } = fakeDatabase();
    for (const body of [valid, { ...valid, website: 'spam' }, { ...valid, email: 'x' }]) {
      const response = await handleCreateFormSubmission(contactRequest(body), bindings(db), 'mi-portafolio');
      expect(await response.text()).not.toContain('project-1');
    }
  });
});
