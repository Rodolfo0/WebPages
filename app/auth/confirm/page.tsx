type SearchParams = Promise<{
  token_hash?: string | string[];
  state?: string | string[];
}>;

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Confirmar correo',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const tokenHash = params.token_hash;
  const state = params.state;
  const hasConfirmation =
    typeof tokenHash === 'string' &&
    tokenHash.length > 0 &&
    typeof state === 'string' &&
    state.length > 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-900">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
          Confirmación de correo
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {hasConfirmation ? 'Confirma tu cuenta' : 'Enlace incompleto'}
        </h1>

        {hasConfirmation ? (
          <>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Pulsa el botón para verificar tu correo e iniciar sesión en este
              navegador.
            </p>
            <form
              action="/auth/confirm/verify"
              method="post"
              className="mt-6"
            >
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="state" value={state} />
              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Confirmar correo
              </button>
            </form>
          </>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            El enlace no contiene los datos necesarios. Vuelve a la aplicación y
            solicita un enlace nuevo.
          </p>
        )}
      </section>
    </main>
  );
}
