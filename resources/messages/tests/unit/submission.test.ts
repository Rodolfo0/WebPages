import { describe, expect, it } from 'vitest';
import {
  CONTACT_MESSAGE_MAX,
  CONTACT_NAME_MAX,
  contactFieldErrors,
  contactMessagesEndpoint,
  contactSubmissionSchema,
  isHoneypotFilled,
} from '../..';

const valid = { name: 'Ana López', email: 'ana@example.test', message: 'Hola, me interesa tu trabajo.' };

function fieldErrors(input: unknown) {
  const result = contactSubmissionSchema.safeParse(input);
  if (result.success) throw new Error('expected the submission to be rejected');
  return contactFieldErrors(result.error);
}

describe('contact submission schema', () => {
  it('normalizes and trims the visible fields', () => {
    const parsed = contactSubmissionSchema.parse({
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
    expect(contactSubmissionSchema.safeParse({ ...valid, message: 'Hola\n\tadiós' }).success).toBe(true);
  });

  it('rejects unknown keys without exposing them as field errors', () => {
    const result = contactSubmissionSchema.safeParse({ ...valid, projectId: 'other-project' });
    expect(result.success).toBe(false);
    if (!result.success) expect(contactFieldErrors(result.error)).toEqual({});
  });

  it('detects a filled honeypot', () => {
    expect(isHoneypotFilled(contactSubmissionSchema.parse({ ...valid, website: '' }))).toBe(false);
    expect(isHoneypotFilled(contactSubmissionSchema.parse(valid))).toBe(false);
    expect(isHoneypotFilled(contactSubmissionSchema.parse({ ...valid, website: 'https://spam.test' }))).toBe(true);
  });

  it('builds the public endpoint from the slug only', () => {
    expect(contactMessagesEndpoint('mi-portafolio')).toBe('/api/sites/mi-portafolio/messages');
  });
});
