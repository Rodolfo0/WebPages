import { FORM_RATE_LIMIT_RETENTION_MS, type FormType, publishedFormExists } from '../domain/forms';
import { type RateLimitWindow, rateLimitWindows, retryAfterSeconds } from './rate-limit';

const SITE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SITE_SLUG_MAX = 63;

/**
 * Resolves where a public form submission belongs.
 *
 * Only the snapshot referenced by `published_version_id` is read, never the draft, and the project
 * must not be archived. The snapshot must contain an active form with that block id and type. A
 * missing, unpublished or archived project and a snapshot without that form all resolve to `null`,
 * so the route answers the same way for each of them.
 */
export async function resolveFormTarget(database: D1Database, slug: string, formId: string, formType: FormType) {
  if (slug.length > SITE_SLUG_MAX || !SITE_SLUG_PATTERN.test(slug)) return null;

  const row = await database.prepare(`
    SELECT project.id AS "projectId", version.id AS "siteVersionId", version.document_json AS "documentJson"
    FROM projects AS project
    INNER JOIN site_versions AS version
      ON version.id = project.published_version_id
      AND version.project_id = project.id
    WHERE project.slug = ? AND project.status <> 'archived'
    LIMIT 1
  `).bind(slug).first<{ projectId: string; siteVersionId: string; documentJson: string }>();
  if (!row) return null;

  let document: unknown;
  try {
    document = JSON.parse(row.documentJson) as unknown;
  } catch {
    return null;
  }
  return publishedFormExists(document, formId, formType)
    ? { projectId: row.projectId, siteVersionId: row.siteVersionId }
    : null;
}

export type FormSubmissionResult =
  | { status: 'accepted' }
  | { status: 'rate_limited'; retryAfterSeconds: number };

type RecordFormSubmissionInput = {
  projectId: string;
  siteVersionId: string;
  formId: string;
  formType: FormType;
  payloadVersion: number;
  /** Validated fields of the form; stored as a JSON object. */
  payload: Record<string, unknown>;
  /** False for honeypot hits: the request consumes the limits but nothing is stored. */
  store: boolean;
  ipKey: string | null;
  now?: number;
  id?: string;
};

const WINDOW_MATCH = 'project_id = ? AND bucket_key = ? AND window_ms = ? AND window_start = ?';

/**
 * Consumes the rate-limit windows and stores the submission in one D1 batch.
 *
 * D1 runs a batch as a single transaction, so the counter increments and the conditional insert
 * observe the same state: two concurrent submissions cannot both pass the last free slot. A rejected
 * request still increments its counters, which keeps a flood from probing the limit for free.
 */
export async function recordFormSubmission(
  database: D1Database,
  input: RecordFormSubmissionInput,
): Promise<FormSubmissionResult> {
  const now = input.now ?? Date.now();
  const windows = rateLimitWindows(now, input.ipKey);
  const windowBindings = (window: RateLimitWindow) => [
    input.projectId, window.bucketKey, window.windowMs, window.windowStart,
  ];

  const statements: D1PreparedStatement[] = [
    database.prepare('DELETE FROM form_submission_rate_limits WHERE window_start < ?')
      .bind(now - FORM_RATE_LIMIT_RETENTION_MS),
    ...windows.map((window) => database.prepare(`
      INSERT INTO form_submission_rate_limits (project_id, bucket_key, window_ms, window_start, count)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT (project_id, bucket_key, window_ms, window_start)
      DO UPDATE SET count = count + 1
      RETURNING count
    `).bind(...windowBindings(window))),
  ];

  if (input.store) {
    const conditions = windows
      .map(() => `(SELECT count FROM form_submission_rate_limits WHERE ${WINDOW_MATCH}) <= ?`)
      .join(' AND ');
    statements.push(database.prepare(`
      INSERT INTO form_submissions
        (id, project_id, site_version_id, form_id, form_type, payload_version, payload_json, status)
      SELECT ?, ?, ?, ?, ?, ?, ?, 'unread'
      WHERE ${conditions}
    `).bind(
      input.id ?? crypto.randomUUID(),
      input.projectId,
      input.siteVersionId,
      input.formId,
      input.formType,
      input.payloadVersion,
      JSON.stringify(input.payload),
      ...windows.flatMap((window) => [...windowBindings(window), window.max]),
    ));
  }

  const results = await database.batch<{ count: number }>(statements);
  const exceeded = windows.filter((window, index) => {
    const count = results[index + 1]?.results?.[0]?.count;
    return typeof count !== 'number' || count > window.max;
  });

  if (input.store) {
    const inserted = (results[results.length - 1]?.meta?.changes ?? 0) === 1;
    if (inserted) return { status: 'accepted' };
    return { status: 'rate_limited', retryAfterSeconds: retryAfterSeconds(exceeded.length > 0 ? exceeded : windows, now) };
  }

  return exceeded.length > 0
    ? { status: 'rate_limited', retryAfterSeconds: retryAfterSeconds(exceeded, now) }
    : { status: 'accepted' };
}
