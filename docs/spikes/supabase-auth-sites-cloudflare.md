# Spike: Supabase Auth con Sites y Cloudflare

- Issue: [#1](https://github.com/Rodolfo0/WebPages/issues/1)
- Fecha de revisión: 12 de octubre de 2026
- Estado: **parcial; la compatibilidad del flujo SSR aún no está verificada en ejecución**

## Resultado provisional

No encontré una incompatibilidad que descarte Supabase. Su SDK base usa APIs disponibles en Workers y la documentación actual de Supabase identifica `@supabase/server` como compatible con Cloudflare Workers. Sin embargo, este proyecto necesita sesiones de navegador disponibles en el servidor, y el paquete previsto para ese modelo es `@supabase/ssr`. No hay una prueba que demuestre que ese paquete y su manejo de cookies funcionan dentro de la combinación concreta de Vinext, Sites y Cloudflare usada aquí.

Por tanto, Supabase sigue siendo una opción viable para probar. Se añadió un arnés pequeño de registro y sesión para probarlo; el spike no debe marcarse como completado hasta pasar el flujo en el runtime real.

## Evidencia del repositorio

- `vite.config.ts` combina Vinext, `@openai/sites-vite-plugin` y `@cloudflare/vite-plugin`. El entorno de Cloudflare incluye `nodejs_compat` y separa los entornos `rsc` y `ssr`.
- `package.json` y `package-lock.json` fijan `@supabase/ssr` 0.12.7 y `@supabase/supabase-js` 2.117.0.
- Se añadió `GET /api/auth/session` como prueba de estructura: lee la sesión de la petición, consulta `auth.getUser()` en el servidor y devuelve solo el ID y correo del usuario. No expone tokens ni crea contraseñas o sesiones propias.
- Se añadieron `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout` y `POST /api/auth/resend-confirmation`, además de `/auth/callback` para intercambiar el código PKCE de confirmación por una sesión de Supabase.
- La pantalla inicial permite ejecutar esos flujos y muestra el resultado de `GET /api/auth/session`. Las contraseñas solo se reciben en memoria para enviarlas a Supabase; no se guardan en D1 ni en otra base propia.
- `lib/auth/supabase-server.ts` crea un cliente por petición y delega lectura y serialización de cookies a `@supabase/ssr`. Las respuestas de esta ruta usan `Cache-Control: private, no-store`.
- `.env.example` fija los nombres iniciales `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`; `env.d.ts` los tipa como bindings de Cloudflare. No se usa una clave `service_role`.
- En este checkout no están instaladas las dependencias ni configuradas variables reales de Supabase. Tampoco están disponibles Wrangler, Supabase CLI o Docker. No fue posible arrancar el Worker ni hablar con un proyecto de prueba.

## Prueba inicial y configuración

La prueba unitaria se ejecuta con:

```sh
cp .env.example .env.local
npm run test:auth
```

La copia `.env.local` sirve de plantilla; se deben reemplazar los valores con los de un proyecto Supabase desechable. El archivo local queda ignorado por Git. El test unitario simula la respuesta del proveedor para comprobar que una sesión ausente se rechaza, que una sesión válida devuelve solo identidad pública y que falta de configuración produce un error claro. **No comprueba conectividad real ni el empaquetado de `@supabase/ssr` en Workers.**

Para la prueba de runtime, el control plane de Cloudflare debe inyectar `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` como variables del Worker; en local se pueden cargar desde `.env.local`. En el proyecto Supabase de prueba también se deben habilitar email/contraseña, configurar el callback local y de preview, y usar una bandeja de correo controlada para confirmación y recuperación.

Con las dependencias instaladas y las variables configuradas, ejecutar `npm run dev` y abrir `http://localhost:3000` (puerto predeterminado de Vinext). La pantalla ofrece registro, login y logout; al entrar, consulta la sesión con `GET /api/auth/session`.

El callback PKCE original permanece en `GET /auth/callback` para enlaces que ya fueron enviados. Si la plantilla aún usa `{{ .ConfirmationURL }}`, `/auth/confirm/start` reenvía el `code` al callback original; ese flujo conserva la limitación de abrirse en el navegador donde se inició el registro. Los correos nuevos deben usar `TokenHash` y una confirmación explícita para crear la sesión en el navegador que abre el correo, aunque sea otro dispositivo.

En **Authentication → Email Templates → Confirm signup**, sustituir el enlace basado en `{{ .ConfirmationURL }}` por:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}">Confirmar correo</a>
```

`signUp()` y `resend()` envían `emailRedirectTo` hacia `/auth/confirm/start`; ese endpoint prepara una confirmación con un paso explícito y no consume el token al cargar la página. El formulario envía el `token_hash` a `POST /auth/confirm/verify`, donde `auth.verifyOtp({ token_hash, type: 'email' })` valida el email y guarda las cookies de sesión en el navegador actual. La protección CSRF usa un estado breve asociado a una cookie del mismo navegador. No se debe verificar el token directamente en un `GET`, porque algunos lectores de correo inspeccionan enlaces automáticamente.

En **Authentication → URL Configuration → Redirect URLs**, permitir `/auth/confirm/start` para cada origen usado al registrarse, por ejemplo `http://localhost:3000/auth/confirm/start` y `http://localhost:5180/auth/confirm/start`. La aplicación incluye el origen de la petición al llamar a Supabase. Un correo ya enviado conserva la URL y el flujo PKCE anteriores; puede requerir el navegador original o se puede solicitar un correo nuevo después de actualizar la plantilla. El proyecto Supabase debe tener Email habilitado.

## Compatibilidad y límites

### Sesiones en SSR

La guía de Supabase recomienda `@supabase/ssr` para sesiones almacenadas en cookies y rotación de refresh tokens. El paquete usa PKCE por defecto. La documentación señala que `@supabase/ssr` sigue en beta y describe integraciones para Next.js y SvelteKit; no documenta Vinext ni Sites directamente. Este es el principal punto de incertidumbre del spike.

`@supabase/server` sí lista Workers como runtime soportado y requiere `nodejs_compat`, que ya está presente en la configuración de Cloudflare del proyecto. Ese paquete resuelve autenticación sin estado con un JWT Bearer por petición; Supabase aclara que no sustituye el ciclo de vida de cookies de `@supabase/ssr`. Solo serviría como alternativa de diseño si la aplicación adopta explícitamente ese modelo de sesión.

Para autorizar peticiones del servidor, la prueba debe usar `auth.getUser()` para consultar al servicio de Auth. `getClaims()` verifica firma y expiración, pero un JWT todavía vigente podría pertenecer a una sesión revocada; `getSession()` no debe ser la fuente de autorización.

Existe un reporte histórico de un fallo `dynamic require of "stream"` con `@supabase/ssr` 0.6.1 en Cloudflare. No demuestra que el fallo continúe en las versiones bloqueadas aquí (0.12.7 y 2.117.0); sí justifica comprobar build y arranque en el runtime real, incluso con `nodejs_compat` habilitado.

### Email

Supabase Auth ofrece registro por email y contraseña, confirmación de email, recuperación mediante `resetPasswordForEmail()` y cambio de contraseña con `updateUser()`. En proyectos alojados, la confirmación está habilitada por defecto. Los enlaces de confirmación y recuperación redirigen a URLs autorizadas en la configuración del proyecto.

El envío requiere SMTP. El servicio de correo de prueba de Supabase tiene un límite documentado de dos mensajes por hora y es de mejor esfuerzo; para producción, Supabase recomienda configurar SMTP propio. La prueba debe usar un proyecto y una bandeja controlados, nunca una cuenta de producción o de otra persona.

### Cloudflare y Sites

- Las rutas que lean o renueven sesiones deben conservar los `Set-Cookie` generados por el adaptador SSR. La integración debe ser por petición para no compartir cookies o clientes con estado entre usuarios.
- Cloudflare omite normalmente del caché de Workers las respuestas con `Set-Cookie` y las peticiones con `Authorization`, pero las rutas autenticadas deben devolver `Cache-Control: private, no-store` y verificarse en el despliegue Sites para descartar reglas o capas de caché adicionales.
- Las URLs locales, de preview y de producción que reciban confirmaciones o recuperaciones deben estar permitidas en la lista de redirect URLs de Supabase. La forma y estabilidad de los dominios de preview de Sites debe verificarse en el proyecto de prueba.
- El proyecto ya activa `nodejs_compat`; esto cubre la condición que la guía de `@supabase/server` publica para Workers, pero no prueba por sí solo el bundle de `@supabase/ssr`.

## Matriz de aceptación

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Registro, inicio y cierre de sesión; validación de sesión en servidor | Parcial | Ya hay rutas de proveedor y una pantalla de prueba; falta ejecutarlas contra un proyecto Supabase y el Worker real. |
| Confirmación y recuperación de email | Parcial | La ruta con `TokenHash` y el paso explícito están implementados para confirmación entre dispositivos; falta configurar la plantilla, permitir las URLs y probar el correo real. La recuperación de contraseña sigue pendiente. |
| Límites de Sites y Cloudflare documentados | Parcial | Se documentan caché, cookies, redirects y la incertidumbre específica de Vinext/Sites; el comportamiento publicado todavía debe comprobarse. |
| Alternativa gestionada si Supabase no es viable | No aplica todavía | No hay evidencia suficiente para declarar Supabase inviable. `@supabase/server` solo cubre un modelo distinto de sesión y no es un reemplazo directo. |
| Sin contraseñas, hashes ni sesiones propias | Cumplido en el diseño actual | El formulario envía credenciales a Supabase y las sesiones usan cookies administradas por `@supabase/ssr`; no se persisten contraseñas, hashes ni sesiones en almacenamiento propio. |

## Pruebas necesarias para cerrar el issue

1. Instalar las dependencias bloqueadas y ejecutar `npm run test:auth`.
2. Configurar un proyecto Supabase desechable y SMTP o una bandeja de prueba controlada; permitir las URLs de callback local y de preview.
3. Arrancar Vinext/Sites con el plugin de Cloudflare y probar `/api/auth/session` con una cookie ausente, inválida y válida.
4. En la pantalla de localhost, probar registro y confirmación; inicio de sesión; lectura del usuario con `getUser()` en una ruta de servidor; cierre de sesión y rechazo de la sesión anterior.
5. Implementar y probar solicitud de recuperación, apertura del enlace, actualización de contraseña y rechazo de la contraseña anterior.
6. Revisar cookies y encabezados de caché en las respuestas de login, refresh, recuperación y logout, y repetir el recorrido en una URL de preview Sites.
7. Si falla, aislar primero si el problema es `@supabase/ssr`, Vinext o el plugin de Sites/Cloudflare. Solo declarar Supabase no viable después de esa reproducción y entonces comparar otro proveedor gestionado con el mismo flujo y runtime.

## Fuentes

- [Supabase: elegir un paquete para el servidor](https://supabase.com/docs/guides/auth/choosing-a-server-package)
- [Supabase: Auth del lado del servidor](https://supabase.com/docs/guides/auth/server-side)
- [Supabase: guía avanzada de SSR y sesiones](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Supabase: autenticación con contraseña y correo](https://supabase.com/docs/guides/auth/passwords)
- [Cloudflare Workers: APIs del runtime](https://developers.cloudflare.com/workers/runtime-apis/)
- [Cloudflare: caché de Workers](https://developers.cloudflare.com/workers/cache/)
- [Reporte histórico de `@supabase/ssr` en Workers](https://github.com/supabase/supabase/issues/37592)
