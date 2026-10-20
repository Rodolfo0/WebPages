# Modelo de datos y persistencia

## Fuente de verdad

El contenido de un sitio debe existir como un documento versionado y validado. No conviene almacenar una copia distinta para el editor React, la publicación React y la exportación Astro. La implementación canónica y sus tipos están en `resources/site-document`; sus consumidores importan desde `resources/site-document/index.ts`.

    type SiteDocument = {
      version: 1
      site: {
        title: string
        slug: string
        description?: string
        theme: ThemeTokens
      }
      pages: PageDocument[]
    }

    type PageDocument = {
      id: string
      path: string
      blocks: BlockInstance[]
    }

    type BlockInstance = {
      id: string
      type: string
      props: Record<string, unknown>
    }

`ThemeTokens` v1 incluye `colors.background`, `colors.text`, `colors.accent`, `typography.heading`, `typography.body` y `spacing`. Los colores son hexadecimales; las fuentes (`sans`, `serif`, `mono`) y el espaciado (`compact`, `comfortable`, `spacious`) son opciones cerradas. El schema aplica los valores iniciales definidos por el contrato cuando se omite el tema o alguno de sus tokens.

`createSiteDocumentSchema(blockRegistry)` construye el validador con los schemas y `defaultProps` del registro de bloques. Los props omitidos toman sus valores iniciales; cada schema de props debe rechazar claves desconocidas. El documento también rechaza propiedades extra en sitio, tema, página y bloque, tipos de bloque sin registrar, versiones distintas de 1, rutas o slugs mal formados y páginas o bloques con IDs repetidos dentro de su ámbito.

Cada cambio debe pasar por una validación de esquema. Una migración futura podrá convertir documentos antiguos a una versión nueva antes de editarlos o publicarlos.

### Migraciones del documento

`version` identifica la forma persistida. Para introducir v2, conserva la validación de v1, agrega una función pura `migrateV1ToV2` y actualiza el discriminador al terminar la conversión. Las conversiones se ejecutan en orden antes de validar con el schema de la versión actual. Valida el resultado final con el registro vigente, guarda un borrador migrado como nueva revisión y conserva los snapshots publicados inmutables. Si no existe una ruta de migración desde la versión leída, rechaza el documento con un error de versión no compatible; no lo reescribas parcialmente.

## D1

El ID de la base enlazada al Worker se configura con `D1_DATABASE_ID`. Es una
variable de configuración de build: en producción se define como variable del
Environment `production` de GitHub Actions; para un build local de producción se
puede usar `.env.production.local`, que Vite carga y Git ignora. Los builds de
producción fallan si la variable no está definida. En desarrollo local se usa
un ID de prueba para que Miniflare pueda crear su binding local.

Tablas iniciales sugeridas:

### users

- id
- auth_subject
- email
- created_at
- updated_at

`auth_subject` es el ID que entrega Supabase Auth y es único. La aplicación no guarda contraseñas, hashes ni tokens. Los IDs internos son UUID generados en el servidor.

Al crear una cuenta, el servidor crea también su fila local usando el ID y el email devueltos por Supabase Auth. La operación es idempotente por `auth_subject`. Si falla, al iniciar sesión se comprueba la fila y se crea si aún falta, antes de permitir operaciones privadas. La identidad nunca se toma del cuerpo de una petición.

### projects

- id
- created_by
- name
- slug
- status
- draft_document_json
- published_version_id
- created_at
- updated_at

El slug debe ser único dentro de la modalidad de URL administrada.

`created_by` conserva quién creó el proyecto, pero no concede acceso. La autorización se deriva de `project_members`. Cada proyecto tiene un único rol de sistema `owner`, asignable a un máximo de tres membresías activas. Al crear el proyecto, se crean en una sola transacción el rol y la membresía owner inicial. Siempre debe quedar al menos un owner activo.

`draft_document_json` conserva el `SiteDocument` completo como JSON validado por la aplicación y por la restricción `json_valid` de D1. El slug se mantiene también en la columna indexada para resolver `/s/:slug`; ambas copias deben actualizarse juntas.

### Autorización por proyecto

- `project_permissions`: catálogo global de permisos con código estable, descripción y marca de si puede asignarse a roles personalizados.
- `project_roles`: roles vinculados a un proyecto. Cada proyecto tiene solo el rol de sistema `owner` al crearse; los owners pueden crear roles personalizados para ese proyecto.
- `project_role_permissions`: permisos globales concedidos a cada rol del proyecto. La referencia al rol debe impedir asignar un rol de otro proyecto.
- `project_members`: membresía de un usuario local en un proyecto, con rol y estado. La unicidad `(project_id, user_id)` evita membresías duplicadas, pero permite hasta tres owners distintos. La base y las operaciones del servidor deben impedir una cuarta membresía owner activa y también impedir revocar la última.

Los owners tienen todos los permisos. `sharing:manage`, `owners:manage` y `project:delete` son exclusivos del rol de sistema `owner`. Los roles personalizados solo reciben permisos explícitamente asignados por un owner; esto puede incluir publicar, consultar o gestionar mensajes y exportar. Los presets (por ejemplo, Editor y Lector) son configuraciones iniciales para crear roles personalizados; no se crean automáticamente como roles del proyecto ni necesitan una fila propia en D1.

### site_versions

- id
- project_id
- document_json
- document_version
- created_at
- published_at

Cada fila representa un snapshot publicado. Un trigger de D1 rechaza cualquier `UPDATE`; volver a publicar crea otra fila. `published_version_id` solo puede apuntar a una versión del mismo proyecto. Al eliminar un proyecto, sus versiones se eliminan en cascada.

### assets

- id
- project_id
- r2_key
- filename
- content_type
- byte_size
- alt_text
- created_at

Los bytes y metadata se administran de forma privada según la membresía y permisos del proyecto. La ruta pública solo puede servir un asset si el snapshot que apunta actualmente `projects.published_version_id` lo referencia; un asset usado solo por el borrador no es público.

### form_submissions

- id
- project_id
- name
- email
- message
- status
- created_at

## R2

R2 almacenará los bytes de imágenes y exportaciones. D1 solo conservará metadata, relaciones de propiedad y claves de objetos.

Las claves de objetos no deben depender únicamente del nombre original. Deben incluir el proyecto y un identificador generado por la aplicación. `assets.r2_key` es única; `filename`, `content_type`, `byte_size`, `alt_text` y fechas son metadata. La fila del asset se relaciona con el proyecto y hereda el acceso permitido por sus membresías y roles.

## Índices

Crear índices para las consultas reales del MVP:

- Membresías por usuario, proyecto y estado; roles por proyecto.
- Proyecto por slug.
- Versiones por project_id y fecha.
- Assets por project_id.
- Mensajes por project_id, estado y fecha.

Los timestamps se guardan como milisegundos Unix en columnas enteras. Los estados permitidos son `draft`, `published` y `archived` para proyectos; `unread`, `read` y `archived` para mensajes.

### Migraciones D1

La infraestructura de ambas bases se agrupa en `database/`; la estructura y los comandos están en [database/README.md](../database/README.md).

El esquema Drizzle vive en `database/d1/schema.ts`. `pnpm db:generate` crea el SQL versionado y su snapshot en `database/d1/migrations/`; revisa la migración antes de aplicarla. Los triggers de inmutabilidad y pertenencia de la versión publicada se expresan como SQL en la migración porque Drizzle no los representa en el schema TypeScript. Conserva esos triggers al crear cambios posteriores.

### Migraciones Supabase

Los cambios SQL específicos de Auth viven en `database/supabase/migrations/` y se aplican
con `supabase --workdir database db push --linked`. Tienen su propio historial en
`supabase_migrations.schema_migrations`; Wrangler y Drizzle administran solo D1.
El workflow de producción aplica ambas series antes de desplegar el Worker.
La configuración de GitHub y el uso local del CLI están en
[Autenticación y seguridad](04-autenticacion-y-seguridad.md).

## Futuro de dominios

Aunque los dominios quedan fuera del MVP, el modelo puede reservar una tabla futura domain_mappings con:

- id
- project_id
- hostname
- path_prefix
- kind
- verification_status
- is_primary

La combinación de hostname y prefijo debe ser única. Esto permite representar un dominio propio por proyecto, un subdominio o varios proyectos bajo distintas subrutas de un mismo dominio.
