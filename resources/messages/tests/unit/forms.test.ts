import { describe, expect, it } from 'vitest';
import {
  CONTACT_MESSAGE_MAX,
  CONTACT_NAME_MAX,
  contactFieldsSchema,
  formSubmissionEndpoint,
  formSubmissionRequestSchema,
  isHoneypotFilled,
  publishedFormExists,
  readStoredFormSubmission,
  validateFormFields,
} from '../..';

const valid = { name: 'Ana López', email: 'ana@example.test', message: 'Hola, me interesa tu trabajo.' };

function fieldErrors(input: unknown) {
  const result = validateFormFields('contact', input);
  if (result.success) throw new Error('expected the fields to be rejected');
  return result.fieldErrors;
}

describe('contact fields schema', () => {
  it('normalizes and trims the visible fields', () => {
    const parsed = contactFieldsSchema.parse({
      name: '  Ａｎａ  ',
      email: ' ana@example.test ',
      message: ' Línea uno\r\nLínea dos ',
    });
    expect(parsed).toEqual({ name: 'Ana', email: 'ana@example.test', message: 'Línea uno\nLínea dos' });
  });

  it('requires name, email and message', () => {
    expect(fieldErrors({ name: ' ', email: '', message: '   ' })).toEqual({
      name: 'Escribe tu nombre.',
      email: 'Escribe tu email.',
      message: 'Escribe tu mensaje.',
    });
  });

  it('rejects an invalid email and over-long fields', () => {
    expect(fieldErrors({ ...valid, email: 'ana@' }).email).toBe('Escribe un email válido.');
    expect(fieldErrors({ ...valid, name: 'a'.repeat(CONTACT_NAME_MAX + 1) }).name).toContain(`${CONTACT_NAME_MAX}`);
    expect(fieldErrors({ ...valid, message: 'a'.repeat(CONTACT_MESSAGE_MAX + 1) }).message).toContain(`${CONTACT_MESSAGE_MAX}`);
  });

  it('rejects control characters, allowing only line breaks and tabs in the message', () => {
    expect(fieldErrors({ ...valid, name: 'Ana\nLópez' }).name).toBe('El nombre contiene caracteres no permitidos.');
    expect(fieldErrors({ ...valid, message: 'Hola\u0000' }).message).toBe('El mensaje contiene caracteres no permitidos.');
    expect(validateFormFields('contact', { ...valid, message: 'Hola\n\tadiós' }).success).toBe(true);
  });

  it('rejects unknown keys and non-objects without exposing them as field errors', () => {
    expect(fieldErrors({ ...valid, projectId: 'other-project' })).toEqual({});
    expect(fieldErrors('texto')).toEqual({});
  });
});

describe('form submission envelope', () => {
  const envelope = { formId: 'block-contact', formType: 'contact', fields: valid };

  it('names the form and keeps the fields for the type schema', () => {
    expect(formSubmissionRequestSchema.parse({ ...envelope, formId: ' block-contact ' })).toEqual(envelope);
  });

  it('rejects unknown form types, missing ids and unknown keys', () => {
    expect(formSubmissionRequestSchema.safeParse({ ...envelope, formType: 'newsletter' }).success).toBe(false);
    expect(formSubmissionRequestSchema.safeParse({ ...envelope, formId: ' ' }).success).toBe(false);
    expect(formSubmissionRequestSchema.safeParse({ ...envelope, formId: 'a'.repeat(129) }).success).toBe(false);
    expect(formSubmissionRequestSchema.safeParse({ ...envelope, projectId: 'other-project' }).success).toBe(false);
  });

  it('detects a filled honeypot', () => {
    expect(isHoneypotFilled(formSubmissionRequestSchema.parse({ ...envelope, website: '' }))).toBe(false);
    expect(isHoneypotFilled(formSubmissionRequestSchema.parse(envelope))).toBe(false);
    expect(isHoneypotFilled(formSubmissionRequestSchema.parse({ ...envelope, website: 'https://spam.test' }))).toBe(true);
  });

  it('builds the public endpoint from the slug only', () => {
    expect(formSubmissionEndpoint('mi-portafolio')).toBe('/api/sites/mi-portafolio/messages');
  });
});

describe('publishedFormExists', () => {
  const documentWith = (props: Record<string, unknown>, type = 'contact', id = 'block-contact') => ({
    pages: [{ blocks: [{ id: 'block-hero', type: 'hero', props: {} }, { id, type, props }] }],
  });

  it('accepts only the visible block with that id, type and the form enabled', () => {
    expect(publishedFormExists(documentWith({ formEnabled: true, hidden: false }), 'block-contact', 'contact')).toBe(true);
    expect(publishedFormExists(documentWith({ formEnabled: true }), 'block-other', 'contact')).toBe(false);
    expect(publishedFormExists(documentWith({ formEnabled: true }), 'block-hero', 'contact')).toBe(false);
    expect(publishedFormExists(documentWith({ formEnabled: true, hidden: true }), 'block-contact', 'contact')).toBe(false);
    expect(publishedFormExists(documentWith({ formEnabled: false }), 'block-contact', 'contact')).toBe(false);
    expect(publishedFormExists(documentWith({}), 'block-contact', 'contact')).toBe(false);
    expect(publishedFormExists(documentWith({ formEnabled: 'true' }), 'block-contact', 'contact')).toBe(false);
    expect(publishedFormExists(documentWith({ formEnabled: true }, 'footer'), 'block-contact', 'contact')).toBe(false);
  });

  it('tolerates malformed documents', () => {
    for (const value of [null, 'text', [], { pages: 'x' }, { pages: [null, { blocks: [null] }] }]) {
      expect(publishedFormExists(value, 'block-contact', 'contact')).toBe(false);
    }
  });
});

describe('readStoredFormSubmission', () => {
  const row = { formType: 'contact', payloadVersion: 1, payloadJson: JSON.stringify(valid) };

  it('interprets a stored payload with the schema of its type and version', () => {
    expect(readStoredFormSubmission(row)).toEqual({ formType: 'contact', payloadVersion: 1, payload: valid });
  });

  it('refuses payloads it cannot interpret', () => {
    expect(readStoredFormSubmission({ ...row, formType: 'newsletter' })).toBeNull();
    expect(readStoredFormSubmission({ ...row, payloadVersion: 2 })).toBeNull();
    expect(readStoredFormSubmission({ ...row, payloadJson: '{"name":' })).toBeNull();
    expect(readStoredFormSubmission({ ...row, payloadJson: JSON.stringify({ name: 'Ana' }) })).toBeNull();
  });
});
