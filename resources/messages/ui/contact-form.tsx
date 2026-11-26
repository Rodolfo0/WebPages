'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  CONTACT_EMAIL_MAX,
  CONTACT_FIELDS,
  CONTACT_MESSAGE_MAX,
  CONTACT_NAME_MAX,
  type ContactField,
  contactFieldsSchema,
} from '../domain/contact';
import { FORM_HONEYPOT_FIELD, FORM_HONEYPOT_MAX, type FormSubmissionRequest } from '../domain/forms';
import styles from './contact-form.module.css';

const contactFormSchema = contactFieldsSchema.extend({
  [FORM_HONEYPOT_FIELD]: z.string().max(FORM_HONEYPOT_MAX).optional(),
});
type ContactFormInput = z.input<typeof contactFormSchema>;
type ContactFormValues = z.output<typeof contactFormSchema>;

export type ContactFormProps = {
  /**
   * Id of the block that renders the form. The server uses it to find the form in the published
   * snapshot, and it prefixes element ids so several forms on one page stay unique.
   */
  formId: string;
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
export function ContactForm({ formId, endpoint, submitLabel, successMessage }: ContactFormProps) {
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: 'idle' });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormInput, unknown, ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { name: '', email: '', message: '', [FORM_HONEYPOT_FIELD]: '' },
  });

  const preview = !endpoint;
  const fieldId = (field: string) => `${formId}-contact-${field}`;
  const statusId = fieldId('status');

  async function submit({ [FORM_HONEYPOT_FIELD]: honeypot, ...fields }: ContactFormValues) {
    if (!endpoint) return;
    setSubmitState({ kind: 'idle' });
    const body: FormSubmissionRequest = { formId, formType: 'contact', fields, [FORM_HONEYPOT_FIELD]: honeypot };
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
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
      const result = await response.json().catch(() => null) as { fields?: Partial<Record<ContactField, string>> } | null;
      for (const field of CONTACT_FIELDS) {
        const message = result?.fields?.[field];
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
          <label htmlFor={fieldId(FORM_HONEYPOT_FIELD)}>No completes este campo</label>
          <input
            id={fieldId(FORM_HONEYPOT_FIELD)}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            {...register(FORM_HONEYPOT_FIELD)}
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
