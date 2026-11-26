export { documentAcceptsContactMessages } from './domain/accepts-messages';
export {
  CONTACT_EMAIL_MAX,
  CONTACT_FIELDS,
  CONTACT_HONEYPOT_FIELD,
  CONTACT_MESSAGE_MAX,
  CONTACT_NAME_MAX,
  CONTACT_RATE_LIMITS,
  CONTACT_REQUEST_MAX_BYTES,
  contactFieldErrors,
  contactMessagesEndpoint,
  contactSubmissionSchema,
  isHoneypotFilled,
} from './domain/submission';
export type {
  ContactField,
  ContactFieldErrors,
  ContactSubmission,
  ContactSubmissionErrorCode,
  ContactSubmissionInput,
} from './domain/submission';
