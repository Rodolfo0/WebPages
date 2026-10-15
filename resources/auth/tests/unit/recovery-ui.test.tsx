// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthPlayground from '../../ui/auth-playground';
import PasswordResetForm from '../../ui/password-reset-form';

const fetchMock = vi.fn<typeof fetch>();
const user = { id: 'user-1', email: 'user@example.test' };
function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}
beforeEach(() => {
  window.history.replaceState({}, '', '/');
  fetchMock.mockReset().mockImplementation(async (input) => String(input).includes('/session')
    ? response({ authenticated: false }, 401) : response({ sent: true }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('password recovery interface', () => {
  it('requests recovery with email only and shows an account-neutral result', async () => {
    render(<AuthPlayground />);
    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Enviar enlace de recuperación' })).toBeEnabled());
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'account@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Si existe una cuenta con ese correo');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/password/recover', expect.objectContaining({
      body: JSON.stringify({ email: 'account@example.test' }),
    }));
  });

  it('offers the password form after recovery and passes only the internal identity', async () => {
    window.history.replaceState({}, '', '/?auth=recovery');
    fetchMock.mockResolvedValue(response({ authenticated: true, user }));
    render(<AuthPlayground />);
    expect(await screen.findByRole('form', { name: 'Cambiar contraseña' })).toBeInTheDocument();
    expect(screen.getByText('Cuenta: ' + user.email)).toBeVisible();
    expect(window.location.search).toBe('');
  });

  it('does not send mismatched passwords', async () => {
    render(<PasswordResetForm user={user} onComplete={vi.fn()} onSessionInvalid={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'test-password-1' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'test-password-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Las contraseñas no coinciden');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([200, 401])('handles password update status %s without putting tokens in the request', async (status) => {
    fetchMock.mockResolvedValue(response({ updated: status === 200 }, status));
    const complete = vi.fn();
    const invalid = vi.fn();
    render(<PasswordResetForm user={user} onComplete={complete} onSessionInvalid={invalid} />);
    for (const label of ['Nueva contraseña', 'Confirmar contraseña']) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: 'new-test-password' } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    await vi.waitFor(() => expect(status === 200 ? complete : invalid).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/password', expect.objectContaining({
      body: JSON.stringify({ password: 'new-test-password' }),
    }));
  });
});
