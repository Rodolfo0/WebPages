// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContactForm } from '../../ui';

const ENDPOINT = '/api/sites/mi-portafolio/messages';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderForm(endpoint: string | null = ENDPOINT) {
  return render(
    <ContactForm formId="block-1" endpoint={endpoint ?? undefined} submitLabel="Enviar mensaje" successMessage="¡Gracias!" />,
  );
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana López' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.test' } });
  fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Hola, me interesa tu trabajo.' } });
}

describe('ContactForm', () => {
  it('shows field errors without sending an invalid form', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderForm();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    expect(await screen.findByText('Escribe tu nombre.')).toBeInTheDocument();
    expect(screen.getByText('Escribe un email válido.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Escribe un email válido.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the message as JSON and confirms it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    renderForm();

    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('¡Gracias!'));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(ENDPOINT);
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } });
    expect(JSON.parse(init.body)).toEqual({
      formId: 'block-1',
      formType: 'contact',
      fields: { name: 'Ana López', email: 'ana@example.test', message: 'Hola, me interesa tu trabajo.' },
      website: '',
    });
    expect(screen.getByLabelText('Nombre')).toHaveValue('');
  });

  it('explains the rate limit and keeps what the visitor typed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    renderForm();

    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Has enviado varios mensajes seguidos'));
    expect(screen.getByLabelText('Mensaje')).toHaveValue('Hola, me interesa tu trabajo.');
  });

  it('keeps the draft when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    renderForm();

    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No se pudo enviar el mensaje'));
    expect(screen.getByLabelText('Nombre')).toHaveValue('Ana López');
  });

  it('keeps the honeypot out of the accessibility tree and the tab order', () => {
    renderForm();
    expect(screen.getAllByRole('textbox').map((input) => input.getAttribute('name'))).toEqual(['name', 'email', 'message']);
    const honeypot = document.querySelector<HTMLInputElement>('input[name="website"]');
    expect(honeypot).toHaveAttribute('tabindex', '-1');
    expect(honeypot).toHaveAttribute('autocomplete', 'off');
  });

  it('renders a disabled preview without an endpoint', () => {
    renderForm(null);
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();
    expect(screen.getByLabelText('Nombre')).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('El formulario funciona en la página publicada.');
  });
});
