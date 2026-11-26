import { describe, expect, it } from 'vitest';
import { documentAcceptsContactMessages } from '../..';

describe('documentAcceptsContactMessages', () => {
  const documentWith = (props: Record<string, unknown>, type = 'contact') => ({ pages: [{ blocks: [{ type, props }] }] });

  it('accepts only a visible contact block with the form enabled', () => {
    expect(documentAcceptsContactMessages(documentWith({ formEnabled: true, hidden: false }))).toBe(true);
    expect(documentAcceptsContactMessages(documentWith({ formEnabled: true, hidden: true }))).toBe(false);
    expect(documentAcceptsContactMessages(documentWith({ formEnabled: false }))).toBe(false);
    expect(documentAcceptsContactMessages(documentWith({}))).toBe(false);
    expect(documentAcceptsContactMessages(documentWith({ formEnabled: 'true' }))).toBe(false);
    expect(documentAcceptsContactMessages(documentWith({ formEnabled: true }, 'footer'))).toBe(false);
  });

  it('tolerates malformed documents', () => {
    for (const value of [null, 'text', [], { pages: 'x' }, { pages: [null, { blocks: [null] }] }]) {
      expect(documentAcceptsContactMessages(value)).toBe(false);
    }
  });
});
