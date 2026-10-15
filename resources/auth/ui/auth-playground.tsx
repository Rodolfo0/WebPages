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
  exists?: boolean;
  user?: AuthUser | null;
  error?: string;
  message?: string;
};

export default function AuthPlayground() {
  const [view, setView] = useState<ViewState>('loading');
  const [mode, setMode] = useState<Mode>('login');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState('');
  const [checkedSignupEmail, setCheckedSignupEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wantsPasswordReset, setWantsPasswordReset] = useState(false);
  const signupPasswordStep = mode === 'signup' && checkedSignupEmail === email;
  const signupEmailStep = mode === 'signup' && !signupPasswordStep;

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
    if (busy) return;
    if (signupPasswordStep && (!passwordConfirmation || password !== passwordConfirmation)) {
      setError('Las contraseñas no coinciden.');
      setMessage('');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        signupEmailStep ? '/api/auth/signup/check-email'
          : mode === 'recover' ? '/api/auth/password/recover'
          : mode === 'signup' ? '/api/auth/signup' : '/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mode === 'recover' || signupEmailStep ? { email } : { email, password }),
        },
      );
      const result = (await response.json()) as ApiResult;

      if (!response.ok) {
        if (result.error === 'auth_not_configured') {
          setView('unavailable');
          setError('El servicio de autenticación no está disponible.');
        } else {
          setError(result.message ?? 'No se pudo completar la solicitud.');
          if (result.error === 'account_already_exists') {
            setMode('login');
            setCheckedSignupEmail(null);
            setPassword('');
            setPasswordConfirmation('');
            setCanResendConfirmation(false);
          }
          if (result.error === 'email_confirmation_required') setCanResendConfirmation(true);
        }
        return;
      }

      if (signupEmailStep) {
        if (typeof result.exists !== 'boolean') {
          setError('No se pudo verificar el correo. Inténtalo de nuevo.');
          return;
        }
        setPassword('');
        setPasswordConfirmation('');
        if (result.exists) {
          setMode('login');
          setCheckedSignupEmail(null);
          setCanResendConfirmation(false);
          setError('Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.');
        } else {
          const normalizedEmail = email.trim().toLowerCase();
          setEmail(normalizedEmail);
          setCheckedSignupEmail(normalizedEmail);
        }
        return;
      }

      setPassword('');
      setPasswordConfirmation('');
      setCheckedSignupEmail(null);
      if (mode === 'recover') {
        setMessage('Si existe una cuenta con ese correo, recibirás un enlace para recuperar el acceso.');
        return;
      }
      if (mode === 'signup' && result.confirmationRequired) {
        setMessage(
          'Si el registro requiere confirmación, recibirás un enlace por correo. Si ya tienes una cuenta, inicia sesión o recupera tu contraseña.',
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
    <main className="grid min-h-dvh place-items-center bg-[#f5f7fb] px-4 py-10 text-slate-900 sm:px-8">
      <div className="w-full max-w-xl">
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
            <div className="mt-9">
              <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setCheckedSignupEmail(null);
                    setPassword('');
                    setPasswordConfirmation('');
                    setError('');
                    setMessage('');
                  }}
                  disabled={busy}
                  aria-pressed={mode === 'login'}
                  className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setCheckedSignupEmail(null);
                    setPassword('');
                    setPasswordConfirmation('');
                    setCanResendConfirmation(false);
                    setError('');
                    setMessage('');
                  }}
                  disabled={busy}
                  aria-pressed={mode === 'signup'}
                  className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Crear cuenta
                </button>
              </div>

              <form onSubmit={submitCredentials} className="space-y-5">
                {mode === 'signup' && <p aria-live="polite" className="text-sm font-medium text-slate-600">
                  {signupEmailStep ? 'Paso 1 de 2: ingresa tu correo' : 'Paso 2 de 2: elige tu contraseña'}
                </p>}
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Correo electrónico
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    disabled={busy}
                    readOnly={signupPasswordStep}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setCheckedSignupEmail(null);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                    placeholder="tu@correo.com"
                  />
                </label>
                {signupPasswordStep && <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setCheckedSignupEmail(null);
                    setPassword('');
                    setPasswordConfirmation('');
                    setError('');
                    setMessage('');
                  }}
                  className="text-sm font-semibold text-indigo-700 disabled:opacity-60"
                >
                  Cambiar correo
                </button>}
                {(mode === 'login' || signupPasswordStep) && <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Contraseña
                  </span>
                  <input
                    type="password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    required
                    disabled={busy}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                    placeholder="Tu contraseña"
                  />
                </label>}

                {signupPasswordStep && <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Confirmar contraseña
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    disabled={busy}
                    value={passwordConfirmation}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                    placeholder="Repite tu contraseña"
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
                    ? signupEmailStep ? 'Verificando correo…' : 'Procesando…'
                    : signupEmailStep
                      ? 'Continuar'
                    : mode === 'recover'
                      ? 'Enviar enlace de recuperación'
                    : mode === 'signup'
                      ? 'Crear cuenta'
                      : 'Iniciar sesión'}
                </button>
              </form>
              {mode === 'login' && (
                <button type="button" onClick={() => {
                  setMode('recover'); setCheckedSignupEmail(null); setPassword(''); setPasswordConfirmation(''); setError(''); setMessage('');
                }} disabled={busy} className="mt-4 text-sm font-semibold text-indigo-700">
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

          {view === 'signed_in' && (message || error) && <div className="mt-8 text-sm">
            {message && (
              <p role="status" className="text-emerald-700">{message}</p>
            )}
            {error && (
              <p role="alert" className="text-rose-700">{error}</p>
            )}
          </div>}
        </section>
      </div>
    </main>
  );
}
