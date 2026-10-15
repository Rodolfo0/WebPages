'use client';

import { useState } from 'react';
import type { AuthUser } from '../domain/auth';

export default function PasswordResetForm({ user, onComplete, onSessionInvalid, onCancel }: {
  user: AuthUser;
  onComplete: () => void;
  onSessionInvalid: () => void;
  onCancel?: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const result = await response.json() as { message?: string };
      if (response.status === 401) {
        setPassword('');
        setConfirmation('');
        onSessionInvalid();
      } else if (!response.ok) {
        setError(result.message ?? 'No se pudo actualizar la contraseña.');
      } else {
        setPassword('');
        setConfirmation('');
        onComplete();
      }
    } catch {
      setError('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} aria-label="Cambiar contraseña" className="mt-9 max-w-lg space-y-5">
      <h2 className="text-xl font-semibold">Elige una contraseña nueva</h2>
      <p className="text-sm text-slate-600">Cuenta: {user.email}</p>
      <label className="block text-sm font-medium">
        Nueva contraseña
        <input type="password" autoComplete="new-password" required value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" />
      </label>
      <label className="block text-sm font-medium">
        Confirmar contraseña
        <input type="password" autoComplete="new-password" required value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" />
      </label>
      {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
      <button type="submit" disabled={busy}
        className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
        {busy ? 'Guardando…' : 'Guardar contraseña'}
      </button>
      {onCancel && <button type="button" onClick={onCancel} disabled={busy}
        className="w-full text-sm font-semibold text-slate-700">Volver a mi cuenta</button>}
    </form>
  );
}
