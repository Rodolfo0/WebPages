# Base de datos

La infraestructura de datos se organiza por proveedor:

```text
database/
  d1/
    index.ts                  # acceso a D1 mediante Drizzle
    env.d.ts                  # binding de Cloudflare
    schema.ts                 # esquema de la aplicación
    drizzle.config.ts         # configuración de generación
    migrations/               # SQL de D1
      meta/                   # snapshots y journal de Drizzle
  supabase/
    config.toml               # configuración del CLI
    migrations/               # SQL de PostgreSQL para Auth
```

## D1

Desde la raíz del repositorio:

```sh
pnpm db:generate
pnpm build
pnpm db:migrate:remote
```

El build de producción requiere `D1_DATABASE_ID`. Wrangler aplica las migraciones
con la configuración generada en `dist/server/wrangler.json`. El binding de Vite
apunta a `database/d1/migrations/`. El acceso del servidor se importa desde
`@/database/d1`.

La configuración de Drizzle usa rutas relativas a la raíz del repositorio.
Conserva los nombres del SQL existente y los archivos `meta/`: moverlos de carpeta
no crea migraciones nuevas ni cambia el historial de D1.

## Supabase

Con el CLI instalado, ejecuta desde la raíz del repositorio:

```sh
supabase login
supabase --workdir database link --project-ref <referencia-del-proyecto>
supabase --workdir database db push --linked
```

`--workdir database` selecciona el directorio que contiene `supabase/config.toml`.
Para crear una migración futura:

```sh
supabase --workdir database migration new nombre_descriptivo
```

El CLI guarda el SQL en `database/supabase/migrations/` y aplica únicamente las
versiones pendientes. No edites migraciones ya aplicadas; agrega una nueva.
Los archivos locales de enlace en `.temp/` y `.branches/` se ignoran en Git.

## Despliegue

GitHub Actions hace build, aplica las migraciones de Supabase, aplica las de D1
y despliega el Worker. Cada base conserva su propio historial. La configuración
de secretos y la política ante fallos están en
[Autenticación y seguridad](../docs/04-autenticacion-y-seguridad.md).
