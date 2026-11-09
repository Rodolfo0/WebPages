import type { AuthEmailLinkPurpose } from '../domain/auth';
import styles from './auth.module.css';

export type EmailLinkSearchParams = Promise<{
  token_hash?: string | string[];
  state?: string | string[];
}>;

export default async function EmailLinkConfirmation({
  searchParams, purpose,
}: {
  searchParams: EmailLinkSearchParams;
  purpose: AuthEmailLinkPurpose;
}) {
  const { token_hash: tokenHash, state } = await searchParams;
  const complete = typeof tokenHash === 'string' && !!tokenHash && typeof state === 'string' && !!state;
  const recovery = purpose === 'recovery';
  return (
    <main className={styles.linkPage}>
      <section className={styles.linkCard}>
        <p className={styles.authEyebrow}>Tu espacio creativo</p>
        <h1 className={styles.linkTitle}>
          {complete ? recovery ? 'Recupera tu acceso' : 'Confirma tu cuenta' : 'Enlace incompleto'}
        </h1>
        {complete ? (
          <>
            <p className={styles.linkCopy}>
              {recovery
                ? 'Pulsa el botón para verificar este enlace y elegir una contraseña nueva.'
                : 'Pulsa el botón para verificar tu correo e iniciar sesión en este navegador.'}
            </p>
            <form action={recovery ? '/auth/recovery/verify' : '/auth/confirm/verify'} method="post" className={styles.linkForm}>
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="state" value={state} />
              <button type="submit" className={styles.primaryButton}>
                {recovery ? 'Continuar con la recuperación' : 'Confirmar correo'}
              </button>
            </form>
          </>
        ) : (
          <p className={styles.linkCopy}>
            El enlace no contiene los datos necesarios. Vuelve a la aplicación y solicita uno nuevo.
          </p>
        )}
      </section>
    </main>
  );
}
