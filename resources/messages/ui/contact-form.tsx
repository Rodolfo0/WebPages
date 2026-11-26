'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  CONTACT_EMAIL_MAX,
  CONTACT_FIELDS,
  CONTACT_HONEYPOT_FIELD,
  CONTACT_MESSAGE_MAX,
  CONTACT_NAME_MAX,
  type ContactField,
  type ContactSubmission,
  type ContactSubmissionInput,
  contactSubmissionSchema,
} from '../domain/submission';
import styles from './contact-form.module.css';

export type ContactFormProps = {
  /** Prefix for element ids; the block id keeps them unique when a page has several forms. */
  idPrefix: string;
  /** Public route that stores the message. Without it the form renders as a disabled preview. */
  endpoint?: string;
  submitLabel: string;
  successMessage: string;
};

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string };

const FIELD_LABELS: Record<ContactField, string> = {
  name: 'Nombre',
  email: 'Email',
  message: 'Mensaje',
};

const GENERIC_ERROR = 'No se pudo enviar el mensaje. Inténtalo de nuevo.';
const RATE_LIMITED_ERROR = 'Has enviado varios mensajes seguidos. Inténtalo más tarde.';

/**
 * Contact form shown by the `contact` block on a published site.
 *
 * It validates with the same schema as the Worker route and keeps what the visitor typed when a
 * request fails. The honeypot input is removed from the accessibility tree and the tab order, so
 * only automated fillers reach it.
 */
export function ContactForm({ idPrefix, endpoint, submitLabel, successMessage }: ContactFormProps) {
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: 'idle' });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactSubmissionInput, unknown, ContactSubmission>({
    resolver: zodResolver(contactSubmissionSchema),
    defaultValues: { name: '', email: '', message: '', [CONTACT_HONEYPOT_FIELD]: '' },
  });

  const preview = !endpoint;
  const fieldId = (field: string) => `${idPrefix}-contact-${field}`;
  const statusId = fieldId('status');

  async function submit(values: ContactSubmission) {
    if (!endpoint) return;
    setSubmitState({ kind: 'idle' });
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(values),
      });
    } catch {
      setSubmitState({ kind: 'error', message: GENERIC_ERROR });
      return;
    }

    if (response.status === 201) {
      reset();
      setSubmitState({ kind: 'sent' });
      return;
    }
    if (response.status === 429) {
      setSubmitState({ kind: 'error', message: RATE_LIMITED_ERROR });
      return;
    }
    if (response.status === 400) {
      const body = await response.json().catch(() => null) as { fields?: Partial<Record<ContactField, string>> } | null;
      for (const field of CONTACT_FIELDS) {
        const message = body?.fields?.[field];
        if (message) setError(field, { type: 'server', message });
      }
      setSubmitState({ kind: 'error', message: 'Revisa los campos del formulario.' });
      return;
    }
    setSubmitState({ kind: 'error', message: GENERIC_ERROR });
  }

  const describedBy = (field: ContactField) => (errors[field] ? `${fieldId(field)}-error` : undefined);

  return (
    <form
      className={styles.form}
      noValidate
      aria-describedby={statusId}
      onSubmit={handleSubmit(submit)}
    >
      <fieldset className={styles.fieldset} disabled={preview || isSubmitting}>
        <legend className={styles.visuallyHidden}>Formulario de contacto</legend>
        {CONTACT_FIELDS.map((field) => (
          <div key={field} className={styles.field}>
            <label className={styles.label} htmlFor={fieldId(field)}>{FIELD_LABELS[field]}</label>
            {field === 'message' ? (
              <textarea
                id={fieldId(field)}
                className={styles.input}
                rows={5}
                maxLength={CONTACT_MESSAGE_MAX}
                aria-invalid={errors[field] ? true : undefined}
                aria-describedby={describedBy(field)}
                {...register(field)}
              />
            ) : (
              <input
                id={fieldId(field)}
                className={styles.input}
                type={field === 'email' ? 'email' : 'text'}
                autoComplete={field}
                maxLength={field === 'email' ? CONTACT_EMAIL_MAX : CONTACT_NAME_MAX}
                aria-invalid={errors[field] ? true : undefined}
                aria-describedby={describedBy(field)}
                {...register(field)}
              />
            )}
            {errors[field]?.message ? (
              <p id={`${fieldId(field)}-error`} className={styles.error}>{errors[field].message}</p>
            ) : null}
          </div>
        ))}
        <div className={styles.honeypot} aria-hidden="true">
          <label htmlFor={fieldId(CONTACT_HONEYPOT_FIELD)}>No completes este campo</label>
          <input
            id={fieldId(CONTACT_HONEYPOT_FIELD)}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            {...register(CONTACT_HONEYPOT_FIELD)}
          />
        </div>
        <button className={styles.submit} type="submit">
          {isSubmitting ? 'Enviando…' : submitLabel || 'Enviar mensaje'}
        </button>
      </fieldset>
      <p id={statusId} className={styles.status} role="status" aria-live="polite">
        {preview
          ? 'El formulario funciona en la página publicada.'
          : submitState.kind === 'sent'
            ? successMessage || 'Gracias, tu mensaje se envió.'
            : submitState.kind === 'error'
              ? submitState.message
              : ''}
      </p>
    </form>
  );
}
