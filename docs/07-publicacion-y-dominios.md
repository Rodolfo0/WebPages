# Publicación y dominios

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
- Rechazar rutas reservadas.
- Ser único dentro del espacio de publicación.
- Mantener redirecciones si cambia y el producto decide soportarlas.

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
