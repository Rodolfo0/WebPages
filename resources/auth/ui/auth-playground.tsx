'use client';

import { useEffect, useState } from 'react';
import type { AuthUser } from '../domain/auth';
import PasswordResetForm from './password-reset-form';

type ViewState = 'loading' | 'signed_out' | 'signed_in' | 'unavailable';
type Mode = 'login' | 'signup' | 'recover';

type ApiResult = {
  authenticated?: boolean;
  confirmationRequired?: boolean;
  sent?: boolean;
  user?: AuthUser | null;
  error?: string;
  message?: string;
};

export default function AuthPlayground() {
  const [view, setView] = useState<ViewState>('loading');
  const [mode, setMode] = useState<Mode>('login');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wantsPasswordReset, setWantsPasswordReset] = useState(false);

  async function refreshSession(requireRecoverySession = false) {
    try {
      const response = await fetch('/api/auth/session', { cache: 'no-store' });
      const result = (await response.json()) as ApiResult;

      if (response.status >= 500) {
        setUser(null);
        setView('unavailable');
        return;
      }

      if (response.ok && result.authenticated && result.user) {
        setUser(result.user);
        setView('signed_in');
        return;
      }

      setUser(null);
      setView('signed_out');
      if (result.error === 'session_expired' || result.error === 'session_invalid') {
        setError(result.message ?? 'Tu sesión venció o no es válida. Inicia sesión de nuevo.');
      } else if (requireRecoverySession) {
        setMode('recover');
        setWantsPasswordReset(false);
        setError('Tu sesión de recuperación no está disponible. Solicita un enlace nuevo.');
      }
    } catch {
      setUser(null);
      setView('unavailable');
    }
  }

  useEffect(() => {
    const authResult = new URLSearchParams(window.location.search).get('auth');
    if (authResult === 'confirmed') {
      // Read the callback result from the browser URL after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessage('Correo confirmado. La sesión está iniciada en este navegador.');
    } else if (authResult === 'callback_error') {
      setError(
        'No se pudo completar la confirmación. Escribe el correo de la cuenta y solicita un enlace nuevo. Usa el enlace más reciente para intentarlo otra vez.',
      );
      setCanResendConfirmation(true);
    } else if (authResult === 'link_expired') {
      setError('El enlace venció o ya se usó. Escribe tu correo y solicita uno nuevo.');
      setCanResendConfirmation(true);
    } else if (authResult === 'recovery') {
      setWantsPasswordReset(true);
    } else if (authResult === 'recovery_error' || authResult === 'recovery_link_expired') {
      setMode('recover');
      setError('El enlace de recuperación venció, ya se usó o no es válido. Solicita uno nuevo.');
    }
    if (authResult) window.history.replaceState({}, '', window.location.pathname);

    void refreshSession(authResult === 'recovery');
    const revalidate = () => { void refreshSession(); };
    window.addEventListener('focus', revalidate);
    return () => window.removeEventListener('focus', revalidate);
  }, []);

  async function submitCredentials(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        mode === 'recover' ? '/api/auth/password/recover' : mode === 'signup' ? '/api/auth/signup' : '/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mode === 'recover' ? { email } : { email, password }),
        },
      );
      const result = (await response.json()) as ApiResult;

      if (!response.ok) {
        if (result.error === 'auth_not_configured') {
          setView('unavailable');
          setError('El servicio de autenticación no está disponible.');
        } else {
          setError(result.message ?? 'No se pudo completar la solicitud.');
          if (result.error === 'email_confirmation_required') setCanResendConfirmation(true);
        }
        return;
      }

      setPassword('');
      if (mode === 'recover') {
        setMessage('Si existe una cuenta con ese correo, recibirás un enlace para recuperar el acceso.');
        return;
      }
      if (mode === 'signup' && result.confirmationRequired) {
        setMessage(
          `Cuenta creada para ${email}. Revisa tu correo y confirma la dirección para iniciar sesión.`,
        );
        setMode('login');
        return;
      }

      await refreshSession();
      setMessage(mode === 'signup' ? 'Registro completado.' : 'Sesión iniciada.');
    } catch {
      setError('No se pudo conectar con el servidor de autenticación.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      const result = (await response.json()) as ApiResult;
      if (!response.ok) {
        setError(result.message ?? 'No se pudo cerrar la sesión.');
        return;
      }

      setUser(null);
      setView('signed_out');
      setWantsPasswordReset(false);
      setMessage('Sesión cerrada.');
    } catch {
      setError('No se pudo conectar con el servidor de autenticación.');
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as ApiResult;

      if (!response.ok) {
        setError(result.message ?? 'No se pudo solicitar otro enlace.');
        return;
      }

      setMessage(
        `Si ${email} tiene una cuenta pendiente, se enviará un nuevo enlace. Revisa tu correo.`,
      );
    } catch {
      setError('No se pudo conectar con el servidor de autenticación.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-10 text-slate-900 sm:px-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
            Acceso a tu cuenta
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Inicia sesión o crea tu cuenta
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Accede a tu cuenta o recupera el acceso desde tu correo.
          </p>

          {view === 'signed_in' && user ? (
            wantsPasswordReset ? (
              <PasswordResetForm user={user} onCancel={() => setWantsPasswordReset(false)} onComplete={() => {
                setWantsPasswordReset(false);
                setMessage('Contraseña actualizada.');
              }} onSessionInvalid={() => {
                setWantsPasswordReset(false);
                setUser(null);
                setView('signed_out');
                setMode('recover');
                setError('Tu sesión venció. Solicita un enlace de recuperación nuevo.');
              }} />
            ) : (
            <div className="mt-9 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    Sesión iniciada
                  </p>
                  <p className="mt-2 text-sm text-emerald-800">{user.email}</p>
                  <p className="mt-1 break-all font-mono text-xs text-emerald-700">
                    ID: {user.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={signOut}
                  disabled={busy}
                  className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 ring-1 ring-slate-300 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                >
                  {busy ? 'Procesando…' : 'Cerrar sesión'}
                </button>
              </div>
              <button type="button" onClick={() => setWantsPasswordReset(true)}
                className="mt-5 text-sm font-semibold text-indigo-700">
                Cambiar contraseña
              </button>
            </div>
            )
          ) : (
            <div className="mt-9 max-w-lg">
              <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setMessage('');
                  }}
                  aria-pressed={mode === 'login'}
                  className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError('');
                    setMessage('');
                  }}
                  aria-pressed={mode === 'signup'}
                  className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Crear cuenta
                </button>
              </div>

              <form onSubmit={submitCredentials} className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Correo electrónico
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                    placeholder="tu@correo.com"
                  />
                </label>
                {mode !== 'recover' && <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Contraseña
                  </span>
                  <input
                    type="password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                    placeholder="Tu contraseña"
                  />
                </label>}

                {error && (
                  <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {error}
                  </p>
                )}
                {message && (
                  <p role="status" className="rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                    {message}
                  </p>
                )}
                {view === 'unavailable' && !error && (
                  <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    El servicio de autenticación no está disponible. Inténtalo de nuevo más tarde.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy || view === 'loading'}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {busy
                    ? 'Procesando…'
                    : mode === 'recover'
                      ? 'Enviar enlace de recuperación'
                    : mode === 'signup'
                      ? 'Crear cuenta'
                      : 'Iniciar sesión'}
                </button>
              </form>
              {mode === 'login' && (
                <button type="button" onClick={() => {
                  setMode('recover'); setPassword(''); setError(''); setMessage('');
                }} className="mt-4 text-sm font-semibold text-indigo-700">
                  ¿Olvidaste tu contraseña?
                </button>
              )}

              {canResendConfirmation && mode === 'login' && (
                <button
                  type="button"
                  onClick={resendConfirmation}
                  disabled={busy || !email.trim()}
                  className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? 'Solicitando…' : 'Reenviar confirmación'}
                </button>
              )}
            </div>
          )}

          <div className="mt-8 min-h-6 text-sm">
            {message && view === 'signed_in' && (
              <p role="status" className="text-emerald-700">{message}</p>
            )}
            {error && view === 'signed_in' && (
              <p role="alert" className="text-rose-700">{error}</p>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Estado de sesión</h2>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                view === 'signed_in'
                  ? 'bg-emerald-100 text-emerald-800'
                  : view === 'unavailable'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-600'
              }`}
            >
              {view === 'loading'
                ? 'Consultando…'
                : view === 'signed_in'
                  ? 'Autenticado'
                  : view === 'unavailable'
                    ? 'Sin conexión'
                    : 'Sin sesión'}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            La sesión se comprueba antes de acceder a la información de tu cuenta.
          </p>
          <ol className="mt-5 space-y-3 border-t border-slate-100 pt-5 text-sm text-slate-600">
            <li><span className="font-semibold text-slate-900">1.</span> Crea una cuenta de prueba.</li>
            <li><span className="font-semibold text-slate-900">2.</span> Confirma tu correo.</li>
            <li><span className="font-semibold text-slate-900">3.</span> Inicia sesión y revisa el estado.</li>
            <li><span className="font-semibold text-slate-900">4.</span> Cierra sesión y confirma que desaparece.</li>
          </ol>
          <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            Solo para desarrollo. No uses contraseñas de otras cuentas.
          </p>
        </aside>
      </div>
    </main>
  );
}
