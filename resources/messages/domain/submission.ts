import { z } from 'zod';

/**
 * Public contact form policy (Issue 18).
 *
 * The same schema validates the browser form and the Worker route, so a visitor sees the exact
 * error the server would return. The server remains the source of truth: the client copy only
 * avoids a round trip.
 */

export const CONTACT_NAME_MAX = 100;
export const CONTACT_EMAIL_MAX = 254;
export const CONTACT_MESSAGE_MAX = 5000;
export const CONTACT_HONEYPOT_MAX = 200;
/** Whole JSON body, including quoting and escapes of the largest valid message. */
export const CONTACT_REQUEST_MAX_BYTES = 16 * 1024;

/** Name of the honeypot field. People never see it; naive bots fill every input they find. */
export const CONTACT_HONEYPOT_FIELD = 'website';

const MINUTE_MS = 60_000;

/**
 * Fixed-window limits. The per-IP windows stop a single sender; the per-project window caps what
 * rotating addresses can push into one inbox and into D1.
 */
export const CONTACT_RATE_LIMITS = [
  { scope: 'ip', windowMs: 10 * MINUTE_MS, max: 3 },
  { scope: 'ip', windowMs: 24 * 60 * MINUTE_MS, max: 10 },
  { scope: 'project', windowMs: 60 * MINUTE_MS, max: 60 },
] as const;

/** Counter rows older than this can no longer affect any window and are deleted. */
export const CONTACT_RATE_LIMIT_RETENTION_MS = 48 * 60 * MINUTE_MS;

// Control characters except tab, line feed and carriage return.
const MESSAGE_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const ANY_CONTROL_CHARACTER = /[\u0000-\u001F\u007F]/;

const normalizedText = () => z.string().overwrite((value) => value.normalize('NFKC')).trim();

export const contactSubmissionSchema = z.strictObject({
  name: normalizedText()
    .min(1, 'Escribe tu nombre.')
    .max(CONTACT_NAME_MAX, `El nombre no puede superar ${CONTACT_NAME_MAX} caracteres.`)
    .refine((value) => !ANY_CONTROL_CHARACTER.test(value), 'El nombre contiene caracteres no permitidos.'),
  email: z
    .string()
    .trim()
    .min(1, 'Escribe tu email.')
    .max(CONTACT_EMAIL_MAX, 'El email es demasiado largo.')
    .pipe(z.email('Escribe un email válido.')),
  message: normalizedText()
    .overwrite((value) => value.replace(/\r\n?/g, '\n'))
    .min(1, 'Escribe tu mensaje.')
    .max(CONTACT_MESSAGE_MAX, `El mensaje no puede superar ${CONTACT_MESSAGE_MAX} caracteres.`)
    .refine((value) => !MESSAGE_CONTROL_CHARACTERS.test(value), 'El mensaje contiene caracteres no permitidos.'),
  [CONTACT_HONEYPOT_FIELD]: z.string().max(CONTACT_HONEYPOT_MAX).optional(),
});

export type ContactSubmissionInput = z.input<typeof contactSubmissionSchema>;
export type ContactSubmission = z.output<typeof contactSubmissionSchema>;

export const CONTACT_FIELDS = ['name', 'email', 'message'] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];
export type ContactFieldErrors = Partial<Record<ContactField, string>>;

/** Maps validation issues to the first message per visible field; other issues are not exposed. */
export function contactFieldErrors(error: z.ZodError): ContactFieldErrors {
  const errors: ContactFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && (CONTACT_FIELDS as readonly string[]).includes(field)) {
      errors[field as ContactField] ??= issue.message;
    }
  }
  return errors;
}

/** True when the hidden field carries anything a person could not have typed into it. */
export function isHoneypotFilled(submission: ContactSubmission) {
  return (submission[CONTACT_HONEYPOT_FIELD] ?? '').trim().length > 0;
}

/** Public endpoint for a site slug. The slug is already public; no project id reaches the page. */
export function contactMessagesEndpoint(slug: string) {
  return `/api/sites/${encodeURIComponent(slug)}/messages`;
}

/** Error codes returned by the public route. They never carry project or member details. */
export type ContactSubmissionErrorCode =
  | 'form_invalid'
  | 'origin_invalid'
  | 'site_not_found'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'rate_limited'
  | 'messages_unavailable';
