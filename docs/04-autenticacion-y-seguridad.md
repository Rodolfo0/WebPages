# Autenticación y seguridad

## Principio

No se debe construir un sistema de contraseñas propio. El registro, el almacenamiento seguro de credenciales, la recuperación de acceso, la verificación de email y la gestión de sesiones deben delegarse a una librería o servicio reconocido y mantenido.

La implementación usa Supabase Auth gestionado y su SDK oficial con `@supabase/ssr` en Cloudflare Workers. El proveedor permanece dentro de `resources/auth/server/supabase-adapter.ts` y `supabase-server.ts`; no se construyen contraseñas ni sesiones propias.

## Adaptador

La aplicación debe ocultar el proveedor detrás de una interfaz pequeña:

    type AuthUser = {
      id: string
      email: string
    }

    interface AuthAdapter {
      getUser(): Promise<AuthUser | null>
      requireUser(): Promise<AuthUser>
      signOut(): Promise<void>
      applyResponse(response: Response): Response
    }

`createAuthAdapter(request, bindings)` crea una instancia por petición y selecciona el proveedor. El contrato también incluye consulta de existencia de correo (`emailExists`), registro, login, reenvío de confirmación, solicitud de recuperación, verificación de enlaces y actualización de contraseña. Sus resultados y errores usan tipos internos; nunca devuelven el cliente, la sesión, tokens, metadata ni errores originales de Supabase.

La API pública para el servidor se importa desde `resources/auth/server`; los tipos compartidos desde `resources/auth`. Los route handlers de `app/` obtienen los bindings de Cloudflare y delegan en esas entradas.

Las cookies de sesión son `HttpOnly`, `SameSite=Lax` y `Secure` en HTTPS. El navegador consulta las rutas de la aplicación y no instancia el SDK de Supabase; la lectura y renovación de tokens ocurre en el servidor. La UI revalida la sesión al volver a enfocar la ventana.

Las superficies HTTP privadas usan `withAuthUser(request, bindings, user => response)`: valida con `requireUser()`, entrega solamente `AuthUser` al recurso y conserva cookies y encabezados de renovación incluso al denegar acceso. Si se usa el adaptador directamente, hay que finalizar toda respuesta con `applyResponse()`. No se deben perder los `Set-Cookie` del SDK ni cachear respuestas privadas.

`getUser()` valida con el servidor de Auth, reutiliza esa comprobación solo dentro de la misma petición y devuelve `null` para sesiones ausentes, inválidas o vencidas sin posibilidad de renovación. `requireUser()` rechaza esos casos con errores internos y HTTP 401; una caída del proveedor produce 502 y una configuración incompleta 503. Un access token vencido se renueva mediante el SDK si su refresh token todavía es válido. La invalidación y eliminación de cookies también se delegan al SDK.

El resto de la aplicación recibe `{ id, email }`, con email obligatorio, no un objeto específico del proveedor. Este `id` identifica al sujeto de autenticación y se relacionará con `users.auth_subject`; no es el UUID interno de la fila D1.

## Flujos

- Registro en dos pasos: comprobar el email y después solicitar contraseña y confirmación. La UI exige que ambas contraseñas coincidan antes de enviar el registro; la confirmación no se incluye en el payload.
- Confirmación de email cuando el proveedor lo requiera.
- Inicio de sesión.
- Cierre de sesión.
- Recuperación y cambio de contraseña mediante el proveedor.
- Renovación y expiración de sesión.
- Mensaje claro para una sesión inválida o expirada.

### Registro en dos pasos

1. La UI solicita solo el correo y envía `POST /api/auth/signup/check-email` con `{ email }`. La ruta exige el origen de la aplicación, valida el email y devuelve únicamente `{ exists: boolean }`, sin caché. El adaptador consulta `public.auth_email_exists` mediante RPC con la clave publicable existente; no crea cuentas ni envía correos.
2. Si existe una cuenta (confirmada, pendiente o invitada), la UI vuelve al login con el correo y ofrece iniciar sesión o recuperar acceso. Si no existe, muestra contraseña y confirmación, y mantiene el correo en solo lectura. «Cambiar correo» regresa al primer paso y descarta las contraseñas. Un error de consulta mantiene al usuario en el primer paso; nunca se interpreta como un correo disponible.
3. El segundo paso envía `POST /api/auth/signup`. La consulta previa no reserva el correo: Supabase sigue siendo responsable de la unicidad y el adaptador conserva el manejo de registros duplicados para cambios ocurridos entre ambos pasos.

Después de que Supabase crea la cuenta, el servidor asegura la fila correspondiente en D1 usando el `id` y el email devueltos por el proveedor. La operación es idempotente por `users.auth_subject`. Si falla la escritura local, el siguiente inicio de sesión vuelve a comprobar la fila y la crea si hace falta; ninguna consulta privada continúa sin una identidad local resuelta. Nunca se toma el ID de usuario del cliente.

#### Configuración en Supabase

La función se crea con [`database/supabase/migrations/20261015000000_add_auth_email_exists.sql`](../database/supabase/migrations/20261015000000_add_auth_email_exists.sql). El CLI aplica solo las migraciones pendientes y registra sus versiones en `supabase_migrations.schema_migrations`; el historial es independiente del de D1. La Data API debe estar habilitada y exponer el esquema `public`.

La función tiene `SECURITY DEFINER` para consultar `auth.users`, fija `search_path = ''` y usa nombres completos de tablas. Solo devuelve la existencia de una coincidencia exacta de correo, ignorando mayúsculas y espacios de los extremos; no devuelve IDs, contraseñas, tokens ni metadata. Revoca los permisos por defecto de `PUBLIC` y concede únicamente ejecución a `anon` y `authenticated`, sin conceder lectura sobre `auth.users`. Esta decisión permite conocer si un correo está registrado también mediante la Data API con la clave publicable.

El workflow `.github/workflows/deploy-production.yml` hace build, aplica las migraciones de Supabase, aplica las de D1 y despliega el Worker. Si falla una migración, no continúa con el despliegue. Una migración completada no se revierte si falla un paso posterior: los cambios de base deben conservar compatibilidad con el Worker anterior. Esta migración agrega una función y no modifica cuentas existentes.

En **GitHub → Settings → Environments → production**, configura:

| Tipo | Nombre | Valor |
| --- | --- | --- |
| Secret | `SUPABASE_ACCESS_TOKEN` | Token personal de Supabase, limitado al proyecto de destino. Para `supabase --workdir database link`, necesita lectura de Project Settings, API Keys y API Key Secrets. |
| Secret | `SUPABASE_DB_PASSWORD` | Contraseña de PostgreSQL del proyecto; no es la contraseña de una cuenta de la aplicación ni una API key. |
| Variable | `SUPABASE_PROJECT_REF` | Referencia del proyecto, el identificador en `https://supabase.com/dashboard/project/<referencia>`. |

Estos valores solo se usan en el paso de migraciones de GitHub Actions. El Worker conserva `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`, sin secretos administrativos adicionales. La referencia del workflow debe corresponder al proyecto de esas variables.

Para aplicar las migraciones al proyecto gestionado usado en desarrollo o pruebas, instala el CLI de Supabase y ejecuta desde la raíz del repositorio:

```sh
supabase login
supabase --workdir database link --project-ref <referencia-del-proyecto>
supabase --workdir database db push --linked
```

`--workdir database` hace que el CLI encuentre `database/supabase/config.toml` y sus migraciones. El workflow usa la misma ruta.

El CLI solicita la contraseña de PostgreSQL; no la incluyas en comandos ni archivos versionados. Si ya ejecutaste el SQL manualmente, esta primera migración puede volver a aplicarlo con `create or replace` y registrar su versión. Si el proyecto ya tiene otras migraciones en su historial, hay que sincronizarlas con el repositorio antes del despliegue; el workflow no repara ni reescribe ese historial automáticamente. Los futuros cambios se agregan como migraciones nuevas, sin editar las versiones ya aplicadas.

Si falta la función o su permiso, la API responde `email_check_not_configured` (503) y la UI no avanza.

#### Registro duplicado al enviar la contraseña

El adaptador traduce `user_already_exists`, `email_exists` y una respuesta de registro sin sesión y con `identities` explícitamente vacío a `account_already_exists` (HTTP 409). Supabase puede devolver esta última respuesta al repetir el registro de una cuenta confirmada; también puede ocultar las identidades de una cuenta invitada. La UI conserva el correo, borra la contraseña y vuelve al inicio de sesión con la opción de recuperar el acceso.

Esta segunda detección usa la respuesta del registro, sin listar usuarios con privilegios administrativos ni usar D1 como fuente de cuentas de Auth. Depende de las señales del proveedor: la ausencia del campo `identities` no se interpreta como cuenta existente. El mensaje de confirmación restante es condicional y no asegura que se creó una cuenta o que se entregó un correo. El error 409 hace visible que el correo ya tiene una cuenta en los casos detectados; la recuperación conserva su respuesta neutral.

La confirmación de email debe funcionar cuando se abre el correo en otro navegador o dispositivo. Para lograrlo con `@supabase/ssr`, la plantilla de confirmación envía `TokenHash` a una página de confirmación de la aplicación; una acción explícita verifica el token mediante `verifyOtp()` y crea la sesión en el navegador que la realizó. No se debe depender del verificador PKCE que quedó en el navegador del registro.

### Recuperación de contraseña

`POST /api/auth/password/recover` solicita el correo y devuelve `{ sent: true }` tanto para cuentas existentes como para correos desconocidos. Los errores operativos no incluyen detalles del proveedor ni confirman la existencia de la cuenta.

En Supabase, configura **Authentication → Email Templates → Reset password** con:

    <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}">Recuperar acceso</a>

Permite `/auth/recovery/start` en **Authentication → URL Configuration → Redirect URLs** para cada origen local, de prueba y producción. El servidor envía esa URL en `resetPasswordForEmail()`; el proyecto debe tener Email/Password habilitado y correo/SMTP configurado.

El enlace llega a `GET /auth/recovery/start`, que prepara una cookie temporal y redirige al formulario de confirmación. Ningún GET consume el token. `POST /auth/recovery/verify` exige el origen de la aplicación y el estado de ese navegador antes de verificar el token de tipo `recovery`. Crea la sesión mediante Supabase, elimina el estado temporal y redirige sin tokens a `/?auth=recovery`.

La pantalla de nueva contraseña recibe un `AuthUser` validado. `POST /api/auth/password` vuelve a exigir origen y usuario autenticado antes de delegar en `updateUser()`. El proveedor aplica su política de contraseña. Si la sesión venció, la UI solicita un enlace nuevo. Los enlaces expirados o reutilizados se rechazan con un mensaje genérico. Las rutas de logout y actualización de contraseña exigen `Origin` igual al origen de la aplicación, también para clientes HTTP fuera del navegador.

## Autorización

La autenticación identifica al usuario. La autorización decide qué puede hacer con cada recurso.

Cada consulta privada debe resolver `AuthUser.id` contra `users.auth_subject` y comprobar en el servidor una membresía activa en el proyecto y el permiso requerido. No basta con ocultar botones en React. Las operaciones que requieren esta comprobación incluyen:

- Leer o modificar un proyecto.
- Subir, eliminar o usar un asset.
- Leer mensajes.
- Crear una versión publicada.
- Generar una exportación.

Cada proyecto tiene un único rol de sistema `owner`, asignado a entre una y tres membresías activas. Todos los owners tienen permisos completos; un owner puede agregar o quitar owners si el proyecto conserva al menos uno y nunca supera tres. Los roles personalizados son propios del proyecto y solo pueden usar los permisos asignados por un owner. Publicar, consultar/gestionar mensajes y exportar requieren el permiso correspondiente; los permisos para gestionar roles, owners o eliminar el proyecto quedan reservados al rol `owner`.

El acceso público a archivos tiene una excepción acotada: solo se sirve un asset si está referenciado por la versión que el proyecto tiene publicada actualmente. La lectura y administración desde el editor siguen siendo privadas y dependen de la membresía y los permisos; que un cliente conozca un `assetId` o `projectId` no concede acceso.

## Reglas de seguridad

- No almacenar contraseñas, hashes, tokens de sesión ni códigos de recuperación en D1.
- No incluir claves privadas en el navegador ni dentro de un ZIP exportado.
- Validar los cuerpos de las peticiones en el servidor.
- Escapar textos y URLs al renderizar bloques.
- Permitir solo protocolos seguros en enlaces externos.
- Comprobar tipo y tamaño antes de guardar archivos.
- Evitar que un usuario use un projectId ajeno aunque lo modifique manualmente en la petición.
- Registrar errores sin guardar contraseñas, tokens o contenido sensible innecesario.
- Mantener dependencias actualizadas y bloquear versiones en producción.

## Pruebas de seguridad

- Registro e inicio de sesión correctos.
- Sesión ausente, inválida y expirada.
- Acceso a un proyecto de otro usuario.
- Creación idempotente de la fila D1 al registrar y reconciliación al siguiente inicio de sesión si falla el primer intento.
- Límite de tres owners activos por proyecto y protección contra quitar al último.
- Manipulación de IDs en rutas y cuerpos.
- Rechazo de assets no referenciados por la versión publicada en rutas públicas.
- Subida de archivos no permitidos.
- Enlaces con protocolos inseguros.
- Recuperación de contraseña sin revelar si un email existe.
