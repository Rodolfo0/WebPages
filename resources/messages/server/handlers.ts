import { isSameOrigin, readLimitedBody, RequestBodyTooLargeError } from '../../../shared/http';
import {
  CONTACT_REQUEST_MAX_BYTES,
  contactFieldErrors,
  contactSubmissionSchema,
  type ContactFieldErrors,
  type ContactSubmissionErrorCode,
  isHoneypotFilled,
} from '../domain/submission';
import { ipBucketKey } from './rate-limit';
import { recordContactSubmission, resolveContactSite } from './submit-message';

type MessageBindings = {
  DB?: D1Database;
  FORM_RATE_LIMIT_SECRET?: string;
};

const ERROR_MESSAGES: Record<ContactSubmissionErrorCode, string> = {
  form_invalid: 'Revisa los campos del formulario.',
  origin_invalid: 'No se pudo enviar el mensaje desde esta página.',
  site_not_found: 'Este sitio no recibe mensajes.',
  payload_too_large: 'El mensaje es demasiado largo.',
  unsupported_media_type: 'Envía el mensaje como JSON.',
  rate_limited: 'Has enviado varios mensajes seguidos. Inténtalo más tarde.',
  messages_unavailable: 'No se pudo enviar el mensaje. Inténtalo de nuevo.',
};

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
  });
}

function errorResponse(
  code: ContactSubmissionErrorCode,
  status: number,
  extra: { fields?: ContactFieldErrors; headers?: Record<string, string> } = {},
) {
  return json(
    { error: code, message: ERROR_MESSAGES[code], ...(extra.fields ? { fields: extra.fields } : {}) },
    status,
    extra.headers,
  );
}

/**
 * `POST /api/sites/{slug}/messages`: stores a message sent from a published site.
 *
 * The route is public, so every answer is deliberately uninformative: the same 404 covers a slug
 * that does not exist, is not published, is archived or has no enabled form, and no response
 * carries project ids, member data or counters. Nothing from the request is logged.
 */
export async function handleCreateFormSubmission(request: Request, bindings: MessageBindings, slug: string) {
  if (!isSameOrigin(request, true)) return errorResponse('origin_invalid', 403);

  const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') return errorResponse('unsupported_media_type', 415);

  let body: Uint8Array<ArrayBuffer>;
  try {
    body = await readLimitedBody(request, CONTACT_REQUEST_MAX_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse('payload_too_large', 413);
    return errorResponse('form_invalid', 400);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)) as unknown;
  } catch {
    return errorResponse('form_invalid', 400);
  }

  const parsed = contactSubmissionSchema.safeParse(payload);
  if (!parsed.success) return errorResponse('form_invalid', 400, { fields: contactFieldErrors(parsed.error) });

  if (!bindings.DB) return errorResponse('messages_unavailable', 503);

  try {
    const site = await resolveContactSite(bindings.DB, slug);
    if (!site) return errorResponse('site_not_found', 404);

    const secret = bindings.FORM_RATE_LIMIT_SECRET?.trim();
    const ip = request.headers.get('cf-connecting-ip')?.trim() || 'unknown';
    const result = await recordContactSubmission(bindings.DB, {
      projectId: site.projectId,
      submission: parsed.data,
      store: !isHoneypotFilled(parsed.data),
      ipKey: secret ? await ipBucketKey(secret, ip) : null,
    });

    if (result.status === 'rate_limited') {
      return errorResponse('rate_limited', 429, { headers: { 'Retry-After': String(result.retryAfterSeconds) } });
    }
    // A honeypot hit gets the same answer as a stored message, so a bot cannot tell it was dropped.
    return json({ ok: true }, 201);
  } catch {
    return errorResponse('messages_unavailable', 503);
  }
}
