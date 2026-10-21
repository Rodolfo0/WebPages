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

### Reemplazar el baseline de una D1 remota vacía

El baseline local inicial ahora usa `projects.created_by` y membresías. La D1
remota puede seguir registrada con la versión anterior de `0000`, que usaba
`projects.owner_id`. D1 registra las migraciones ya aplicadas; editar el SQL no
vuelve a ejecutar una migración con el mismo nombre. Si `0000` ya está aplicada
en remoto, elimina y vuelve a crear `site-creator-d1` solo mientras siga vacía:

```sh
pnpm exec wrangler d1 delete site-creator-d1
pnpm exec wrangler d1 create site-creator-d1
```

La base nueva tendrá otro UUID. Actualiza la variable `D1_DATABASE_ID` del
Environment `production` en GitHub y ejecuta el workflow de despliegue; este
reconstruye la configuración y aplica el nuevo baseline antes de publicar el
Worker. Si `0000` aún no se aplicó, el primer despliegue puede aplicar el baseline
actual sin recrear la base. Los comandos de borrado/creación son remotos y
eliminan la base anterior.

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
