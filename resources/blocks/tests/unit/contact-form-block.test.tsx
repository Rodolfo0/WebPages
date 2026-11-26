// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_THEME_TOKENS } from '../../../site-document';
import { contactBlock, contactPropsSchema } from '../../ui/portfolio/contact';

afterEach(cleanup);

const ContactBlock = contactBlock.reactComponent;

describe('contact block form props', () => {
  it('keeps drafts saved before the form existed valid, with the form off', () => {
    const { formEnabled, formSubmitLabel, formSuccessMessage, ...legacyProps } = contactBlock.defaultProps;
    expect(formEnabled).toBe(false);
    expect(contactPropsSchema.parse(legacyProps)).toMatchObject({
      formEnabled: false,
      formSubmitLabel,
      formSuccessMessage,
    });
  });

  it('rejects the render-only endpoint as a document prop', () => {
    const result = contactPropsSchema.safeParse({ ...contactBlock.defaultProps, contactFormEndpoint: 'https://evil.test' });
    expect(result.success).toBe(false);
  });

  it('renders the form only when enabled', () => {
    const { rerender } = render(<ContactBlock blockId="block-1" theme={DEFAULT_THEME_TOKENS} props={contactBlock.defaultProps} />);
    expect(screen.queryByRole('button', { name: 'Enviar mensaje' })).not.toBeInTheDocument();

    rerender(
      <ContactBlock
        blockId="block-1"
        theme={DEFAULT_THEME_TOKENS}
        props={{ ...contactBlock.defaultProps, formEnabled: true }}
        contactFormEndpoint="/api/sites/mi-portafolio/messages"
      />,
    );
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeEnabled();
  });

  it('shows a disabled preview without the public endpoint', () => {
    render(<ContactBlock blockId="block-1" theme={DEFAULT_THEME_TOKENS} props={{ ...contactBlock.defaultProps, formEnabled: true }} />);
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();
  });
});
