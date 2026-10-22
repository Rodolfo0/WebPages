# Site Creator

Aplicación React para crear y publicar sitios. Se ejecuta con Vinext sobre Cloudflare Workers, usa Supabase Auth para las cuentas y D1 para los datos de la aplicación.

## Requisitos

- Node.js `>=22.13.0`.
- pnpm.
- Un proyecto de Supabase con Email habilitado. Cloudflare solo es necesario para usar la D1 remota o desplegar.

## Instalación local

Desde la raíz del repositorio:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Edita `.env.local` y completa los valores del proyecto Supabase:

```dotenv
SUPABASE_URL=https://<referencia>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<clave-publicable>
```

Usa la clave publicable del proyecto; la aplicación no requiere una clave `service_role`. Habilita Email/Password en **Supabase → Authentication → Providers → Email**. Si la confirmación de correo está habilitada, confirma la cuenta antes de iniciar sesión.

### Migración de Supabase

El formulario de registro consulta si el correo ya existe mediante una función de Supabase. La Data API debe estar habilitada y exponer el esquema `public`. Para habilitar ese flujo, instala el CLI de Supabase si no lo tienes y aplica la migración al proyecto de desarrollo:

```sh
supabase login
supabase --workdir database link --project-ref <referencia-del-proyecto>
supabase --workdir database db push --linked
```

Las migraciones de Supabase y D1 son independientes. Esta migración instala la función de consulta de correo; no crea las tablas de la aplicación en D1. Consulta [Autenticación y seguridad](docs/04-autenticacion-y-seguridad.md) para plantillas de correo, SMTP y recuperación de contraseña.

En **Supabase → Authentication → URL Configuration**, usa `http://localhost:3000` como URL local y permite estas rutas de redirección:

```text
http://localhost:3000/auth/confirm/start
http://localhost:3000/auth/recovery/start
```

Si ejecutas la aplicación en otro puerto, añade las mismas rutas con ese origen. En **Authentication → Email Templates**, configura **Confirm signup** y **Reset password** para enviar `TokenHash` a la aplicación:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}">Confirmar correo</a>
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}">Recuperar acceso</a>
```

### D1 local

Por defecto, el desarrollo usa una D1 simulada local de Miniflare. Deja `D1_REMOTE` sin definir y no pongas un `D1_DATABASE_ID` remoto en `.env.local`. La primera vez, aplica las migraciones a esa D1 local:

```sh
D1_DATABASE_ID=00000000-0000-4000-8000-000000000000 pnpm build
pnpm exec wrangler d1 migrations apply site-creator-d1 --local --config dist/server/wrangler.json
```

El UUID del comando es el identificador local predeterminado de `vite.config.ts`. La migración inicial crea `users` y el esquema base; la siguiente agrega referencias de assets a las versiones publicadas.

### Usar una D1 remota en desarrollo (opcional)

Para conectar Vinext a una D1 de desarrollo en Cloudflare, agrega su UUID a `.env.local`:

```dotenv
D1_DATABASE_ID=<uuid-de-la-d1-remota>
```

Autentica Wrangler una vez y ejecuta Vinext con el binding remoto habilitado:

```sh
pnpm exec wrangler login
D1_REMOTE=true pnpm dev --port 3000 --strictPort
```

Si ya tienes `CLOUDFLARE_API_TOKEN` en el entorno, no ejecutes `wrangler login`; inicia Vinext directamente con `D1_REMOTE=true`. La D1 remota debe tener aplicadas las migraciones de `database/d1/migrations/`. Si faltan, genera primero la configuración y aplica las migraciones a la base indicada por `D1_DATABASE_ID`:

```sh
pnpm build
pnpm db:migrate:remote
```

Esto modifica el esquema de esa base remota. Para desarrollo, es preferible una D1 de pruebas.

## Iniciar la aplicación

Con `.env.local` configurado y las migraciones D1 aplicadas, ejecuta:

```sh
pnpm dev --port 3000 --strictPort
```

Abre [http://localhost:3000](http://localhost:3000). Vinext usa el puerto 3000 por defecto. Ejecutar Vite directamente suele usar 5173; Playwright usa 5180. Si cambias de puerto, actualiza también las URL de redirección de Supabase.

## Comandos habituales

```sh
pnpm lint
pnpm build
pnpm test:unit
pnpm test:integration
pnpm test:e2e
```

Las pruebas de integración requieren las variables de un proyecto Supabase de prueba en `.env.test.local`. Las pruebas E2E también necesitan una cuenta confirmada. Configura esos valores desde `.env.test.example` y sigue [Pruebas y roadmap](docs/09-pruebas-y-roadmap.md). No uses cuentas personales ni una clave `service_role`.

## Más documentación

- [Arquitectura React](docs/02-arquitectura-react.md)
- [Autenticación y seguridad](docs/04-autenticacion-y-seguridad.md)
- [Base de datos y migraciones](database/README.md)
- [Pruebas y roadmap](docs/09-pruebas-y-roadmap.md)
- [Publicación y dominios](docs/07-publicacion-y-dominios.md)
