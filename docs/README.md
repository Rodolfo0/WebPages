# Documentación del proyecto

Esta carpeta contiene el detalle técnico y de producto detrás de PLAN.md. El plan resume las decisiones principales; estos documentos explican cómo llevarlas a cabo y qué preguntas siguen abiertas.

## Documentos

1. [Producto y alcance](01-producto-y-alcance.md)  
   Objetivo, usuarios, flujo principal, MVP, métricas y límites.
2. [Arquitectura React](02-arquitectura-react.md)  
   Estructura de la aplicación, rutas, estado del editor y separación entre cliente y servidor.
3. [Modelo de datos y persistencia](03-datos-y-persistencia.md)  
   Documento de sitio, tablas D1, archivos R2, versiones y relaciones de propiedad.
4. [Autenticación y seguridad](04-autenticacion-y-seguridad.md)  
   Integración con una solución reconocida, sesiones, permisos, secretos y controles de seguridad.
5. [Editor y sistema de bloques](05-editor-y-bloques.md)  
   Catálogo inicial, propiedades, reordenamiento, accesibilidad y experiencia de edición.
6. [Media y formularios](06-media-y-formularios.md)  
   Subida de imágenes, biblioteca de assets, formulario público y bandeja de mensajes.
7. [Publicación y dominios](07-publicacion-y-dominios.md)  
   Resolución de URLs, subrutas, dominios propios, subdominios y evolución futura.
8. [Generación y exportación Astro](08-generacion-astro.md)  
   Pipeline de exportación, componentes compartidos, límites y decisión de no usar Astro como runtime del MVP.
9. [Pruebas y roadmap](09-pruebas-y-roadmap.md)  
   Estrategia de pruebas, fases de implementación y temas que conviene profundizar.

## Orden recomendado de lectura

Para entender la propuesta completa, leer primero 01, 02 y 03. Después revisar 05 y 08, que definen cómo el mismo documento alimenta el editor React, la publicación y la exportación Astro. 04, 06 y 07 detallan las superficies que necesitan controles de seguridad y operación.

## Decisiones ya tomadas

- El editor se construirá con React.
- La publicación administrada usará un renderizador React.
- Astro será una exportación opcional, no el motor principal del MVP.
- El MVP usará subrutas administradas.
- Más adelante se podrán usar dominios propios por proyecto, subdominios o subrutas bajo un dominio propio compartido.
- La primera plantilla se enfocará en portafolios y curriculums.
- La autenticación no se implementará desde cero.

## Temas pendientes de profundizar

- Confirmar qué proveedor de autenticación gestionada es compatible con el runtime de Sites.
- Confirmar si la publicación React puede entregar HTML inicial renderizado en servidor dentro del despliegue elegido.
- Definir límites de tamaño, formatos y transformaciones de imágenes.
- Elegir la estrategia de colas si la exportación Astro o la generación de ZIP tarda más que una petición normal.
- Definir cómo se verifican dominios propios y cómo se gestionan certificados.
- Decidir si el formulario exportado debe conectarse a la bandeja de la plataforma o convertirse en un enlace de contacto.
- Añadir plantillas para restaurante y landing general después de validar el flujo de portafolio.
