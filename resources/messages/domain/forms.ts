import { z } from 'zod';
import { CONTACT_FIELDS, CONTACT_PAYLOAD_VERSION, contactFieldsSchema } from './contact';

/**
 * Public form policy shared by every form type.
 *
 * A submission is stored as a JSON payload plus the metadata needed to read it back: the form type,
 * the payload version, the id of the block that rendered the form and the published snapshot it
 * belonged to. Each form type registers here the block that renders it and the schema of its
 * current payload version.
 */

/** Whole JSON body, including quoting and escapes of the largest valid contact message. */
export const FORM_REQUEST_MAX_BYTES = 16 * 1024;

/** Name of the honeypot field. People never see it; naive bots fill every input they find. */
export const FORM_HONEYPOT_FIELD = 'website';
export const FORM_HONEYPOT_MAX = 200;

/** Same bound as block ids in a SiteDocument. */
export const FORM_ID_MAX = 128;

const MINUTE_MS = 60_000;

/**
 * Fixed-window limits shared by every form of a project. The per-IP windows stop a single sender;
 * the per-project window caps what rotating addresses can push into one inbox and into D1.
 */
export const FORM_RATE_LIMITS = [
  { scope: 'ip', windowMs: 10 * MINUTE_MS, max: 3 },
  { scope: 'ip', windowMs: 24 * 60 * MINUTE_MS, max: 10 },
  { scope: 'project', windowMs: 60 * MINUTE_MS, max: 60 },
] as const;

/** Counter rows older than this can no longer affect any window and are deleted. */
export const FORM_RATE_LIMIT_RETENTION_MS = 48 * 60 * MINUTE_MS;

export const FORM_TYPES = ['contact'] as const;
export type FormType = (typeof FORM_TYPES)[number];

/** Block that renders each form type, current payload version, and the schema of that payload. */
export const FORM_DEFINITIONS = {
  contact: {
    blockType: 'contact',
    payloadVersion: CONTACT_PAYLOAD_VERSION,
    fields: CONTACT_FIELDS,
    fieldsSchema: contactFieldsSchema,
  },
} as const satisfies Record<FormType, {
  blockType: string;
  payloadVersion: number;
  fields: readonly string[];
  fieldsSchema: z.ZodType<Record<string, unknown>>;
}>;

export type FormPayload<T extends FormType> = z.output<(typeof FORM_DEFINITIONS)[T]['fieldsSchema']>;

/**
 * Envelope of `POST /api/sites/{slug}/messages`. `fields` is checked afterwards against the schema
 * of `formType`; the server then confirms in the published snapshot that `formId` is a form of that
 * type, so the client never decides what is stored or where.
 */
export const formSubmissionRequestSchema = z.strictObject({
  formId: z.string().trim().min(1).max(FORM_ID_MAX),
  formType: z.enum(FORM_TYPES),
  fields: z.unknown(),
  [FORM_HONEYPOT_FIELD]: z.string().max(FORM_HONEYPOT_MAX).optional(),
});

export type FormSubmissionRequest = z.output<typeof formSubmissionRequestSchema>;

export type FormFieldErrors = Record<string, string>;

export type FormFieldsResult =
  | { success: true; payload: Record<string, unknown> }
  | { success: false; fieldErrors: FormFieldErrors };

/** Validates the fields of one form type, exposing only the first message per known field. */
export function validateFormFields(formType: FormType, fields: unknown): FormFieldsResult {
  const definition = FORM_DEFINITIONS[formType];
  const parsed = definition.fieldsSchema.safeParse(fields);
  if (parsed.success) return { success: true, payload: parsed.data };
  return { success: false, fieldErrors: formFieldErrors(parsed.error, definition.fields) };
}

/** Maps validation issues to the first message per visible field; other issues are not exposed. */
export function formFieldErrors(error: z.ZodError, fields: readonly string[]): FormFieldErrors {
  const errors: FormFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && fields.includes(field)) errors[field] ??= issue.message;
  }
  return errors;
}

/** True when the hidden field carries anything a person could not have typed into it. */
export function isHoneypotFilled(request: FormSubmissionRequest) {
  return (request[FORM_HONEYPOT_FIELD] ?? '').trim().length > 0;
}

/**
 * Finds an active form of the given type in a published SiteDocument.
 *
 * It reads the block `id`, `type` and the `formEnabled` and `hidden` props, which are part of the
 * persisted SiteDocument contract. The check is structural on purpose: snapshots are immutable and
 * were validated when published, so a later schema change must not make an old snapshot unreadable
 * here. Snapshots published before `formEnabled` existed lack it and therefore accept no messages.
 */
export function publishedFormExists(document: unknown, formId: string, formType: FormType): boolean {
  if (!isRecord(document) || !Array.isArray(document.pages)) return false;
  const { blockType } = FORM_DEFINITIONS[formType];
  return document.pages.some((page) => isRecord(page)
    && Array.isArray(page.blocks)
    && page.blocks.some((block) => isRecord(block)
      && block.id === formId
      && block.type === blockType
      && isRecord(block.props)
      && block.props.formEnabled === true
      && block.props.hidden !== true));
}

export type StoredFormSubmission = {
  [T in FormType]: { formType: T; payloadVersion: number; payload: FormPayload<T> };
}[FormType];

/**
 * Reads back the payload of a stored submission.
 *
 * Returns null for an unknown form type or payload version, or a payload that no longer matches its
 * schema, so a reader never shows fields it cannot interpret. A future payload version keeps its
 * predecessor's schema here, or converts it, before the current schema changes.
 */
export function readStoredFormSubmission(row: {
  formType: string;
  payloadVersion: number;
  payloadJson: string;
}): StoredFormSubmission | null {
  if (!(FORM_TYPES as readonly string[]).includes(row.formType)) return null;
  const formType = row.formType as FormType;
  const definition = FORM_DEFINITIONS[formType];
  if (row.payloadVersion !== definition.payloadVersion) return null;

  let value: unknown;
  try {
    value = JSON.parse(row.payloadJson) as unknown;
  } catch {
    return null;
  }
  const parsed = definition.fieldsSchema.safeParse(value);
  return parsed.success ? { formType, payloadVersion: row.payloadVersion, payload: parsed.data } : null;
}

/** Public endpoint for a site slug. The slug is already public; no project id reaches the page. */
export function formSubmissionEndpoint(slug: string) {
  return `/api/sites/${encodeURIComponent(slug)}/messages`;
}

/** Error codes returned by the public route. They never carry project or member details. */
export type FormSubmissionErrorCode =
  | 'form_invalid'
  | 'origin_invalid'
  | 'site_not_found'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'rate_limited'
  | 'messages_unavailable';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
