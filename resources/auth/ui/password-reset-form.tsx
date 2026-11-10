'use client';

import { useState } from 'react';
import type { AuthUser } from '../domain/auth';
import styles from './auth.module.css';

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
    <form onSubmit={submit} aria-label="Cambiar contraseña" className={styles.resetForm}>
      <h2 className={styles.resetTitle}>Elige una contraseña nueva</h2>
      <p className={styles.resetCopy}>Cuenta: {user.email}</p>
      <label className={styles.field}>
        Nueva contraseña
        <input type="password" autoComplete="new-password" required value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={styles.input} />
      </label>
      <label className={styles.field}>
        Confirmar contraseña
        <input type="password" autoComplete="new-password" required value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className={styles.input} />
      </label>
      {error && <p role="alert" className={styles.notice} data-tone="error">{error}</p>}
      <div className={styles.buttonStack}>
        <button type="submit" disabled={busy} className={styles.primaryButton}>
          {busy ? 'Guardando…' : 'Guardar contraseña'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} disabled={busy}
          className={styles.textButton}>Omitir e ir a mis proyectos</button>}
      </div>
    </form>
  );
}
