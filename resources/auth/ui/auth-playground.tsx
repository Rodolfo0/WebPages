'use client';

import { useEffect, useRef, useState } from 'react';
import { LayoutTemplate, MonitorSmartphone, Rocket } from 'lucide-react';
import type { AuthUser } from '../domain/auth';
import PasswordResetForm from './password-reset-form';
import styles from './auth.module.css';

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

const PROJECTS_PATH = '/app/projects';

function replaceLocation(path: string) {
  window.location.replace(path);
}

export default function AuthPlayground({ navigate = replaceLocation }: { navigate?: (path: string) => void } = {}) {
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
  // Keeps the recovery form open even when focus revalidates the session.
  const passwordResetPending = useRef(false);
  const navigateRef = useRef(navigate);
  const signupPasswordStep = mode === 'signup' && checkedSignupEmail === email;
  const signupEmailStep = mode === 'signup' && !signupPasswordStep;
  const heading = view === 'signed_in'
    ? wantsPasswordReset ? 'Recupera el acceso' : 'Abriendo tus proyectos'
    : mode === 'signup'
      ? 'Crea tu cuenta'
      : mode === 'recover'
        ? 'Recupera el acceso'
        : 'Vuelve a tus proyectos';
  const description = view === 'signed_in'
    ? wantsPasswordReset ? 'Guarda una contraseña nueva para tu cuenta.' : 'Tu sesión está activa. Te llevamos a tus proyectos.'
    : mode === 'signup'
      ? 'Crea un espacio para diseñar y publicar tu portafolio.'
      : mode === 'recover'
        ? 'Te enviaremos instrucciones para recuperar tu cuenta.'
        : 'Inicia sesión para continuar con tus proyectos.';

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  function goToProjects() {
    navigateRef.current(PROJECTS_PATH);
  }

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
        if (!requireRecoverySession && !passwordResetPending.current) navigateRef.current(PROJECTS_PATH);
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
      passwordResetPending.current = true;
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
    <main className={styles.authPage}>
      <aside className={styles.showcase} aria-label="Site Creator">
        <BrandMark />
        <div className={styles.showcaseCopy}>
          <p className={styles.showcaseTitle}>Diseña tu portafolio sección por sección.</p>
          <p className={styles.showcaseText}>
            Combina bloques listos, edita su contenido y revisa cómo se ve en escritorio y móvil antes de publicar.
          </p>
        </div>
        <EditorPreview />
        <ul className={styles.featureList}>
          <li><LayoutTemplate size={16} aria-hidden="true" /> Secciones listas para usar</li>
          <li><MonitorSmartphone size={16} aria-hidden="true" /> Vista previa adaptable</li>
          <li><Rocket size={16} aria-hidden="true" /> Publica cuando esté listo</li>
        </ul>
      </aside>
      <div className={styles.formPanel}>
        <div className={styles.formPanelBrand}><BrandMark /></div>
        <section className={styles.authCard}>
          <p className={styles.authEyebrow}>Tu espacio creativo</p>
          <h1 className={styles.authTitle}>{heading}</h1>
          <p className={styles.authDescription}>{description}</p>

          {view === 'signed_in' && user ? (
            wantsPasswordReset ? (
              <PasswordResetForm user={user} onCancel={goToProjects} onComplete={() => {
                passwordResetPending.current = false;
                goToProjects();
              }} onSessionInvalid={() => {
                passwordResetPending.current = false;
                setWantsPasswordReset(false);
                setUser(null);
                setView('signed_out');
                setMode('recover');
                setError('Tu sesión venció. Solicita un enlace de recuperación nuevo.');
              }} />
            ) : (
              <p role="status" className={`${styles.redirecting} ${styles.authBody}`}>
                <span className={styles.spinner} aria-hidden="true" />
                Redirigiendo…
              </p>
            )
          ) : (
            <div className={styles.authBody}>
              {mode === 'recover' ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setMessage('');
                  }}
                  disabled={busy}
                  className={styles.textButton}
                >
                  ← Volver a iniciar sesión
                </button>
              ) : <div className={styles.modeSwitch}>
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
                  className={styles.modeButton}
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
                  className={styles.modeButton}
                >
                  Crear cuenta
                </button>
              </div>}

              <form onSubmit={submitCredentials} className={styles.form}>
                {mode === 'signup' && <p aria-live="polite" className={styles.stepHint}>
                  {signupEmailStep ? 'Paso 1 de 2 · Correo electrónico' : 'Paso 2 de 2 · Elige una contraseña'}
                </p>}
                <label className={styles.field}>
                  Correo electrónico
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
                    className={styles.input}
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
                  className={styles.textButton}
                >
                  Cambiar correo
                </button>}
                {(mode === 'login' || signupPasswordStep) && <label className={styles.field}>
                  Contraseña
                  <input
                    type="password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    required
                    disabled={busy}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={styles.input}
                    placeholder="Tu contraseña"
                  />
                </label>}

                {signupPasswordStep && <label className={styles.field}>
                  Confirmar contraseña
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    disabled={busy}
                    value={passwordConfirmation}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                    className={styles.input}
                    placeholder="Repite tu contraseña"
                  />
                </label>}

                {error && (
                  <p role="alert" className={styles.notice} data-tone="error">
                    {error}
                  </p>
                )}
                {message && (
                  <p role="status" className={styles.notice} data-tone="info">
                    {message}
                  </p>
                )}
                {view === 'unavailable' && !error && (
                  <p role="status" className={styles.notice} data-tone="warning">
                    El servicio de autenticación no está disponible. Inténtalo de nuevo más tarde.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy || view === 'loading'}
                  className={styles.primaryButton}
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
                }} disabled={busy} className={styles.textButton}>
                  ¿Olvidaste tu contraseña?
                </button>
              )}

              {canResendConfirmation && mode === 'login' && (
                <button
                  type="button"
                  onClick={resendConfirmation}
                  disabled={busy || !email.trim()}
                  className={styles.secondaryButton}
                >
                  {busy ? 'Solicitando…' : 'Reenviar confirmación'}
                </button>
              )}
            </div>
          )}

        </section>
        <p className={styles.formFooter}>Tu acceso está protegido con autenticación segura.</p>
      </div>
    </main>
  );
}

function BrandMark() {
  return (
    <span className={styles.brand}>
      <svg className={styles.brandLogo} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22 19.27A2.73 2.73 0 0 1 19.27 22h-4.54A2.73 2.73 0 0 1 12 19.27V12h7.27A2.73 2.73 0 0 1 22 14.73z" fill="#68C4FF" />
        <path d="M20 2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#0C79D8" />
        <path d="M7 15a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z" fill="#0C79D8" />
        <path d="M12 12H4.73A2.73 2.73 0 0 1 2 9.27V4.73A2.73 2.73 0 0 1 4.73 2h4.54A2.73 2.73 0 0 1 12 4.73z" fill="#2E9EFF" />
      </svg>
      Site Creator
    </span>
  );
}

function EditorPreview() {
  return (
    <div className={styles.preview} aria-hidden="true">
      <div className={styles.previewBar}>
        <span /><span /><span />
      </div>
      <div className={styles.previewBody}>
        <div className={styles.previewSidebar}>
          <i data-active="true" /><i /><i /><i />
        </div>
        <div className={styles.previewCanvas}>
          <div className={styles.previewHero}>
            <b /><b /><b />
          </div>
          <div className={styles.previewGrid}>
            <span /><span /><span />
          </div>
        </div>
      </div>
    </div>
  );
}
