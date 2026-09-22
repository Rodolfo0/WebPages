# Generación y exportación Astro

## Decisión

Astro vale la pena como exportación portable. No se usará como motor principal de publicación en el MVP porque un build separado por proyecto añade una cola de trabajos, artefactos, invalidación y más infraestructura.

La URL administrada seguirá usando React y el export Astro reutilizará el mismo SiteDocument.

## Contrato compartido

El registro de bloques debe conocer ambos renderizadores:

    type BlockDefinition = {
      type: string
      propsSchema: unknown
      reactComponent: unknown
      astroComponentPath: string
    }

Cada bloque valida sus props antes de renderizar. El exportador no debe concatenar texto del usuario dentro de archivos JavaScript o TypeScript. Debe escribir datos en JSON y pasar esos datos a componentes fijos.

## Estructura del proyecto exportado

    astro-site/
      public/
        assets/
      src/
        components/
          blocks/
        data/
          site.json
        layouts/
          SiteLayout.astro
        pages/
          index.astro
      astro.config.mjs
      package.json
      README.md

En la primera versión se puede exportar una sola página. El esquema ya debe permitir pages para no bloquear páginas adicionales después.

## Pipeline

1. Obtener el snapshot publicado.
2. Validar la versión de SiteDocument.
3. Resolver todos los assets referenciados.
4. Copiar la plantilla Astro fija.
5. Escribir site.json y metadata SEO.
6. Copiar assets con nombres estables.
7. Generar el archivo de configuración del formulario sin secretos.
8. Ejecutar comprobación y build en un entorno controlado si se entrega un proyecto ya compilado.
9. Empaquetar el código fuente y, opcionalmente, dist/.
10. Guardar el resultado en R2 y devolver una descarga temporal.

La exportación debe ser repetible: el mismo snapshot y los mismos assets deben producir el mismo contenido lógico.

## Formulario

El sitio administrado puede enviar mensajes directamente a la bandeja interna. Un ZIP Astro descargado en otro hosting no debe contener credenciales para acceder a esa bandeja.

Por defecto, el export incluirá enlaces de contacto. Un formulario conectado requerirá configurar explícitamente un endpoint público y sus reglas de origen, límites y protección contra abuso.

## Alternativas futuras

Astro estático necesita conocer las rutas dinámicas durante el build mediante getStaticPaths. Astro SSR puede resolver rutas al solicitarse usando un adaptador de servidor. La documentación oficial describe ambas modalidades y el adaptador oficial para Cloudflare:

- [Routing](https://docs.astro.build/en/guides/routing/)
- [On-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/)
- [Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)

Si el producto necesita SEO más avanzado, despliegues fuera de la plataforma o sitios estáticos independientes, se puede añadir una fase con Astro SSR compartido o builds estáticos por sitio. Ambos deben reutilizar el esquema existente.
