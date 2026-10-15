import type { AuthEmailLinkPurpose } from '../domain/auth';

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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-900">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          {complete ? recovery ? 'Recupera tu acceso' : 'Confirma tu cuenta' : 'Enlace incompleto'}
        </h1>
        {complete ? (
          <>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {recovery
                ? 'Pulsa el botón para verificar este enlace y elegir una contraseña nueva.'
                : 'Pulsa el botón para verificar tu correo e iniciar sesión en este navegador.'}
            </p>
            <form action={recovery ? '/auth/recovery/verify' : '/auth/confirm/verify'} method="post" className="mt-6">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="state" value={state} />
              <button type="submit" className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700">
                {recovery ? 'Continuar con la recuperación' : 'Confirmar correo'}
              </button>
            </form>
          </>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            El enlace no contiene los datos necesarios. Vuelve a la aplicación y solicita uno nuevo.
          </p>
        )}
      </section>
    </main>
  );
}
