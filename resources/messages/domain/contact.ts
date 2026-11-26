import { z } from 'zod';

/**
 * Fields of the `contact` form type (Issue 18), stored as payload version 1.
 *
 * The same schema validates the browser form and the Worker route, so a visitor sees the exact
 * error the server would return. The server remains the source of truth: the client copy only
 * avoids a round trip. Changing the shape of these fields requires a new payload version.
 */

export const CONTACT_PAYLOAD_VERSION = 1;

export const CONTACT_NAME_MAX = 100;
export const CONTACT_EMAIL_MAX = 254;
export const CONTACT_MESSAGE_MAX = 5000;

// Control characters except tab, line feed and carriage return.
const MESSAGE_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const ANY_CONTROL_CHARACTER = /[\u0000-\u001F\u007F]/;

const normalizedText = () => z.string().overwrite((value) => value.normalize('NFKC')).trim();

export const contactFieldsSchema = z.strictObject({
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
});

export type ContactFieldsInput = z.input<typeof contactFieldsSchema>;
export type ContactFields = z.output<typeof contactFieldsSchema>;

export const CONTACT_FIELDS = ['name', 'email', 'message'] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];
