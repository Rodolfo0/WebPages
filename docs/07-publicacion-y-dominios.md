# Publicación y dominios

## Despliegue de la aplicación

GitHub Actions publica el Worker al hacer push a `main` o al ejecutar
manualmente el workflow en esa rama. El orden es lint, build de producción,
migraciones D1 remotas y `wrangler deploy`. El plugin de Cloudflare genera la
configuración de Wrangler en `dist/server/wrangler.json` durante el build. El
comando de migraciones usa `--config dist/server/wrangler.json`; no sigue el
archivo de redirección `.wrangler/deploy/config.json` que consume `wrangler
deploy`. Ambos comandos usan la configuración generada por el mismo build. D1
registra cada migración aplicada y los siguientes despliegues solo ejecutan las
pendientes.

Antes del primer despliegue, crea una base D1 llamada `site-creator-d1` y un
bucket R2 llamado `site-creator-r2` en la cuenta de Cloudflare. El binding D1
`DB` y el binding R2 `FILES` ya están definidos por `.openai/hosting.json` y
`vite.config.ts`; la base debe existir antes de ejecutar el workflow. El Worker
se publica con el nombre `site-creator`. Créalo una vez en Cloudflare si quieres
que el token de GitHub solo necesite permiso de edición.

En GitHub, crea el Environment `production` y configura:

- Secret `CLOUDFLARE_API_TOKEN`, con permisos para editar Workers y escribir en
  D1, limitado a la cuenta del proyecto.
- Secret `CLOUDFLARE_ACCOUNT_ID`, con el ID de esa cuenta.
- Variable `D1_DATABASE_ID`, con el UUID de `site-creator-d1`.
- Variable `VARS_JSON`, con un objeto JSON que incluya
  `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`, además de cualquier otra variable
  pública requerida por el Worker.
- Secret `SECRETS_JSON`, con un objeto JSON de secretos runtime; usa `{}`
  si el Worker no necesita secretos adicionales. El workflow los pasa a Wrangler
  durante el despliegue sin mostrarlos en los logs.

No guardes el token en el repositorio. El token necesita permisos Workers Edit
para publicar el Worker y D1 Edit para las migraciones, ambos limitados a la
cuenta del proyecto. Si Wrangler debe crear el Worker en el primer despliegue,
el token también necesita permisos para crearlo.

Si el lint o build falla, no se ejecutan migraciones. Si una migración falla,
Wrangler revierte esa migración y el workflow no publica el Worker. Si la
migración pasa pero falla el despliegue, el esquema permanece aplicado; por eso
las migraciones deben ser compatibles con el Worker anterior y los cambios
destructivos deben retirarse en un despliegue posterior. No se restaura D1
automáticamente porque eso puede descartar escrituras recientes.

## Publicación del MVP

La primera versión usa una URL administrada por subruta:

    /s/mi-portafolio

El flujo es:

1. El usuario publica un borrador válido.
2. Se crea una versión inmutable.
3. El proyecto apunta a esa versión como published_version_id.
4. La ruta pública resuelve el slug.
5. React renderiza únicamente el snapshot publicado.

Los cambios posteriores se quedan en el borrador hasta que el usuario vuelva a publicar.

## Normalización de slugs

El slug debe:

- Usar minúsculas.
- Permitir letras, números y guiones.
- Tener hasta 63 caracteres.
- Rechazar rutas reservadas.
- Ser único dentro del espacio de publicación.
- Mantener redirecciones si cambia y el producto decide soportarlas.

El dashboard normaliza acentos, espacios y puntuación antes de validar. Los
slugs `admin`, `api`, `app`, `assets`, `auth`, `login`, `public`, `register`,
`s` y `settings` están reservados. Al cambiar un slug, el servidor actualiza la
columna indexada del proyecto y el slug de su borrador en una sola operación.

## Modalidades futuras

El sistema deberá poder resolver estas formas:

1. Subruta administrada: /s/mi-portafolio.
2. Dominio propio por proyecto: www.estudio-ejemplo.com.
3. Subdominio bajo un dominio compartido: mi-portafolio.producto.com.
4. Dominio propio compartido con subrutas: misitio.com/portafolio.

La resolución futura debe considerar hostname y prefijo de ruta. No debe asumir que el slug es suficiente para identificar un sitio.

## Dominio propio

La implementación futura necesitará:

- Registro del hostname y prefijo de ruta.
- Estado de verificación.
- Instrucciones DNS.
- Comprobación de propiedad.
- Emisión o gestión de certificado TLS.
- Prevención de colisiones entre propietarios.
- Redirección de HTTP a HTTPS.
- Manejo de dominio principal y aliases.

La compra de dominios y la configuración DNS no forman parte del MVP.

## Caché e invalidación

Una publicación debe invalidar o versionar la respuesta pública. El sistema no debe servir un snapshot viejo después de confirmar la publicación, salvo que exista una ventana de caché documentada.

## SEO básico

Cada proyecto publicado debe permitir título, descripción, URL canónica y datos básicos para compartir. Si el runtime no entrega HTML inicial desde el servidor, hay que resolverlo antes de considerar completa la publicación de landing pages.
