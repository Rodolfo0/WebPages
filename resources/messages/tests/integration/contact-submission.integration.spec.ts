import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { getPlatformProxy } from 'wrangler';
import { handleCreateFormSubmission, recordContactSubmission } from '../../server';
import { ipBucketKey } from '../../server/rate-limit';

/**
 * Exercises the contact form SQL against a real local D1 (Miniflare/workerd).
 *
 * Each run creates an isolated, temporary D1 and applies the repository migrations with Wrangler,
 * so the suite never touches the developer's local data. Publishing (Issue 21) does not exist yet,
 * so published snapshots are inserted directly.
 */

const ORIGIN = 'https://sites.example.test';
const SECRET = 'integration-test-hmac-key';
const valid = { name: 'Ana López', email: 'ana@example.test', message: 'Hola, me interesa tu trabajo.' };

let stateDirectory: string;
let database: D1Database;
let disposeProxy: (() => Promise<void>) | undefined;

test.beforeAll(async () => {
  stateDirectory = mkdtempSync(join(tmpdir(), 'site-creator-messages-'));
  const configPath = join(stateDirectory, 'wrangler.json');
  writeFileSync(configPath, JSON.stringify({
    name: 'site-creator-messages-integration',
    compatibility_date: '2026-10-13',
    d1_databases: [{
      binding: 'DB',
      database_name: 'site-creator-d1',
      database_id: '00000000-0000-4000-8000-000000000000',
      migrations_dir: resolve('database/d1/migrations'),
    }],
  }));
  const persistTo = join(stateDirectory, 'state');
  execFileSync(resolve('node_modules/.bin/wrangler'), [
    'd1', 'migrations', 'apply', 'site-creator-d1', '--local', '--config', configPath, '--persist-to', persistTo,
  ], { stdio: 'pipe', env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' } });

  const proxy = await getPlatformProxy<{ DB: D1Database }>({ configPath, persist: { path: join(persistTo, 'v3') } });
  database = proxy.env.DB;
  disposeProxy = proxy.dispose;
});

test.afterAll(async () => {
  await disposeProxy?.();
  if (stateDirectory) rmSync(stateDirectory, { recursive: true, force: true });
});

function publishedDocument(contactProps: Record<string, unknown>) {
  return JSON.stringify({ version: 1, pages: [{ blocks: [{ type: 'contact', props: contactProps }] }] });
}

async function seedProject(options: { formEnabled?: boolean; published?: boolean; status?: 'draft' | 'published' | 'archived' } = {}) {
  const userId = randomUUID();
  const projectId = randomUUID();
  const slug = `sitio-${projectId.slice(0, 8)}`;
  await database.prepare('INSERT INTO users (id, auth_subject, email) VALUES (?, ?, ?)')
    .bind(userId, `subject-${userId}`, `${userId}@example.test`).run();
  await database.prepare(`
    INSERT INTO projects (id, created_by, name, slug, status, draft_document_json)
    VALUES (?, ?, 'Portafolio', ?, ?, ?)
  `).bind(projectId, userId, slug, options.status ?? 'published', publishedDocument({ formEnabled: true })).run();

  if (options.published ?? true) {
    const versionId = randomUUID();
    await database.prepare(`
      INSERT INTO site_versions (id, project_id, document_json, document_version, published_at)
      VALUES (?, ?, ?, 1, ?)
    `).bind(versionId, projectId, publishedDocument({ formEnabled: options.formEnabled ?? true, hidden: false }), Date.now()).run();
    await database.prepare('UPDATE projects SET published_version_id = ? WHERE id = ?').bind(versionId, projectId).run();
  }
  return { projectId, slug };
}

function submit(slug: string, body: Record<string, unknown> = valid, ip = '203.0.113.7') {
  const request = new Request(`${ORIGIN}/api/sites/${slug}/messages`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  });
  return handleCreateFormSubmission(request, { DB: database, FORM_RATE_LIMIT_SECRET: SECRET }, slug);
}

async function storedMessages(projectId: string) {
  const { results } = await database.prepare(
    'SELECT name, email, message, status FROM form_submissions WHERE project_id = ?',
  ).bind(projectId).all();
  return results;
}

test('stores a message for the published project as unread', async () => {
  const { projectId, slug } = await seedProject();

  const response = await submit(slug, { ...valid, name: '  Ana López ' });

  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ ok: true });
  expect(await storedMessages(projectId)).toEqual([{ ...valid, status: 'unread' }]);
});

test('refuses unpublished, archived and form-disabled projects alike', async () => {
  const cases = await Promise.all([
    seedProject({ published: false }),
    seedProject({ status: 'archived' }),
    seedProject({ formEnabled: false }),
  ]);

  for (const { projectId, slug } of cases) {
    const response = await submit(slug);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'site_not_found', message: 'Este sitio no recibe mensajes.' });
    expect(await storedMessages(projectId)).toEqual([]);
  }
  expect((await submit('sitio-inexistente')).status).toBe(404);
});

test('drops honeypot hits while counting them, without storing the address', async () => {
  const { projectId, slug } = await seedProject();

  const response = await submit(slug, { ...valid, website: 'https://spam.example.test' });

  expect(response.status).toBe(201);
  expect(await storedMessages(projectId)).toEqual([]);
  const { results } = await database.prepare(
    'SELECT bucket_key AS bucketKey, count FROM form_submission_rate_limits WHERE project_id = ? ORDER BY window_ms',
  ).bind(projectId).all<{ bucketKey: string; count: number }>();
  expect(results).toHaveLength(3);
  expect(results.every((row) => row.count === 1)).toBe(true);
  expect(JSON.stringify(results)).not.toContain('203.0.113.7');
});

test('limits one address per project and leaves other addresses unaffected', async () => {
  const { projectId } = await seedProject();
  const now = Date.UTC(2026, 10, 25, 10, 1);
  const sameAddress = await ipBucketKey(SECRET, '198.51.100.1');
  const otherAddress = await ipBucketKey(SECRET, '198.51.100.2');
  const send = (ipKey: string) => recordContactSubmission(database, { projectId, submission: valid, store: true, ipKey, now });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    expect(await send(sameAddress)).toEqual({ status: 'accepted' });
  }
  expect(await send(sameAddress)).toEqual({ status: 'rate_limited', retryAfterSeconds: 540 });
  expect(await send(otherAddress)).toEqual({ status: 'accepted' });
  expect(await storedMessages(projectId)).toHaveLength(4);
});

test('does not let concurrent submissions pass the limit', async () => {
  const { projectId } = await seedProject();
  const now = Date.UTC(2026, 10, 25, 10, 1);
  const ipKey = await ipBucketKey(SECRET, '198.51.100.3');

  const results = await Promise.all(Array.from({ length: 8 }, () => (
    recordContactSubmission(database, { projectId, submission: valid, store: true, ipKey, now })
  )));

  expect(results.filter((result) => result.status === 'accepted')).toHaveLength(3);
  expect(await storedMessages(projectId)).toHaveLength(3);
});

test('caps a project even when addresses rotate or no secret is configured', async () => {
  const { projectId } = await seedProject();
  const now = Date.UTC(2026, 10, 25, 10, 1);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await recordContactSubmission(database, { projectId, submission: valid, store: true, ipKey: null, now });
    expect(result.status).toBe('accepted');
  }
  const blocked = await recordContactSubmission(database, { projectId, submission: valid, store: true, ipKey: null, now });
  expect(blocked).toEqual({ status: 'rate_limited', retryAfterSeconds: 3540 });
});

test('removes counter rows that can no longer affect any window', async () => {
  const { projectId } = await seedProject();
  const now = Date.UTC(2026, 10, 25, 10, 1);
  await database.prepare(`
    INSERT INTO form_submission_rate_limits (project_id, bucket_key, window_ms, window_start, count)
    VALUES (?, 'project', 3600000, ?, 60)
  `).bind(projectId, now - 3 * 24 * 3_600_000).run();

  await recordContactSubmission(database, { projectId, submission: valid, store: true, ipKey: null, now });

  const { results } = await database.prepare(
    'SELECT window_start AS windowStart FROM form_submission_rate_limits WHERE project_id = ?',
  ).bind(projectId).all<{ windowStart: number }>();
  expect(results.map((row) => row.windowStart)).toEqual([Date.UTC(2026, 10, 25, 10)]);
});

test.describe('public route in the local Worker', () => {
  // The Vinext dev server already blocks foreign origins before routing, so the request without an
  // Origin header is the case that reaches the handler; unit tests cover a foreign origin.
  test('is routed and rejects requests without the application origin', async ({ request, baseURL }) => {
    const anonymous = await request.post('/api/sites/mi-portafolio/messages', { data: valid });
    expect(anonymous.status()).toBe(403);
    expect(anonymous.headers()['cache-control']).toBe('no-store');
    expect(await anonymous.json()).toMatchObject({ error: 'origin_invalid' });

    const wrongType = await request.post('/api/sites/mi-portafolio/messages', {
      headers: { Origin: baseURL!, 'Content-Type': 'text/plain' },
      data: 'hola',
    });
    expect(wrongType.status()).toBe(415);
  });

  test('answers a malformed slug with the generic 404', async ({ request, baseURL }) => {
    const response = await request.post('/api/sites/No_Valido/messages', { headers: { Origin: baseURL! }, data: valid });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: 'site_not_found', message: 'Este sitio no recibe mensajes.' });
  });
});
