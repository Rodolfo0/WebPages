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

`createAuthAdapter(request, bindings)` crea una instancia por petición y selecciona el proveedor. El contrato también incluye registro, login, reenvío de confirmación, solicitud de recuperación, verificación de enlaces y actualización de contraseña. Sus resultados y errores usan tipos internos; nunca devuelven el cliente, la sesión, tokens, metadata ni errores originales de Supabase.

La API pública para el servidor se importa desde `resources/auth/server`; los tipos compartidos desde `resources/auth`. Los route handlers de `app/` obtienen los bindings de Cloudflare y delegan en esas entradas.

Las cookies de sesión son `HttpOnly`, `SameSite=Lax` y `Secure` en HTTPS. El navegador consulta las rutas de la aplicación y no instancia el SDK de Supabase; la lectura y renovación de tokens ocurre en el servidor. La UI revalida la sesión al volver a enfocar la ventana.

Las superficies HTTP privadas usan `withAuthUser(request, bindings, user => response)`: valida con `requireUser()`, entrega solamente `AuthUser` al recurso y conserva cookies y encabezados de renovación incluso al denegar acceso. Si se usa el adaptador directamente, hay que finalizar toda respuesta con `applyResponse()`. No se deben perder los `Set-Cookie` del SDK ni cachear respuestas privadas.

`getUser()` valida con el servidor de Auth, reutiliza esa comprobación solo dentro de la misma petición y devuelve `null` para sesiones ausentes, inválidas o vencidas sin posibilidad de renovación. `requireUser()` rechaza esos casos con errores internos y HTTP 401; una caída del proveedor produce 502 y una configuración incompleta 503. Un access token vencido se renueva mediante el SDK si su refresh token todavía es válido. La invalidación y eliminación de cookies también se delegan al SDK.

El resto de la aplicación recibe `{ id, email }`, con email obligatorio, no un objeto específico del proveedor. Este `id` identifica al sujeto de autenticación y se relacionará con `users.auth_subject`; no es el UUID interno de la fila D1.

## Flujos

- Registro con email y contraseña.
- Confirmación de email cuando el proveedor lo requiera.
- Inicio de sesión.
- Cierre de sesión.
- Recuperación y cambio de contraseña mediante el proveedor.
- Renovación y expiración de sesión.
- Mensaje claro para una sesión inválida o expirada.

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

Cada consulta privada debe comprobar el propietario en el servidor. No basta con ocultar botones en React. Las operaciones que requieren esta comprobación incluyen:

- Leer o modificar un proyecto.
- Subir, eliminar o usar un asset.
- Leer mensajes.
- Crear una versión publicada.
- Generar una exportación.

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
- Manipulación de IDs en rutas y cuerpos.
- Subida de archivos no permitidos.
- Enlaces con protocolos inseguros.
- Recuperación de contraseña sin revelar si un email existe.
