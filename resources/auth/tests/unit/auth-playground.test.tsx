// @vitest-environment jsdom

import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthPlayground from '../../ui/auth-playground';

function jsonResponse(body: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('AuthPlayground in JSDOM', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    fetchMock.mockImplementation(async (input) => {
      if (String(input).includes('/api/auth/session')) {
        return jsonResponse({ authenticated: false }, 401);
      }

      if (String(input).includes('/api/auth/resend-confirmation')) {
        return jsonResponse({ sent: true }, 200);
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('offers a resend action when Supabase reports an expired confirmation link', async () => {
    window.history.replaceState({}, '', '/?auth=link_expired');
    render(<AuthPlayground />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El enlace venció o ya se usó',
    );
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'new-user@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar confirmación' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'se enviará un nuevo enlace',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/resend-confirmation',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'new-user@example.test' }),
      }),
    );
  });

  it('redirects to projects when a session already exists', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ authenticated: true, user: { id: 'user-1', email: 'user@example.test' } }, 200));
    const navigate = vi.fn();
    render(<AuthPlayground navigate={navigate} />);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app/projects'));
    expect(screen.getByRole('status')).toHaveTextContent('Redirigiendo');
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });

  it('redirects to projects right after logging in', async () => {
    let authenticated = false;
    fetchMock.mockImplementation(async (input) => {
      if (String(input).includes('/api/auth/login')) {
        authenticated = true;
        return jsonResponse({ authenticated: true }, 200);
      }
      return authenticated
        ? jsonResponse({ authenticated: true, user: { id: 'user-1', email: 'user@example.test' } }, 200)
        : jsonResponse({ authenticated: false }, 401);
    });
    const navigate = vi.fn();
    render(<AuthPlayground navigate={navigate} />);

    const submit = screen.getAllByRole('button', { name: 'Iniciar sesión', exact: true }).at(-1)!;
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'user@example.test' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'test-password' } });
    fireEvent.click(submit);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app/projects'));
  });
});
