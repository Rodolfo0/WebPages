# Editor y sistema de bloques

## Catálogo inicial

La primera plantilla debe resolver un portafolio/CV completo con estos bloques:

- Hero o presentación.
- Sobre mí.
- Experiencia profesional.
- Proyectos destacados.
- Habilidades.
- Testimonios opcionales.
- Contacto y redes.
- Pie de página.

Cada bloque debe tener una composición terminada. El usuario cambia el contenido y algunos parámetros visuales, no la estructura completa.

## Contrato de un bloque

    type BlockDefinition = {
      type: string
      label: string
      description: string
      defaultProps: Record<string, unknown>
      propsSchema: unknown
      reactComponent: unknown
      astroComponentPath: string
    }

La definición centraliza el nombre del bloque, sus valores iniciales, validación y renderizadores. El editor usa reactComponent; el exportador Astro usa astroComponentPath.

## Propiedades permitidas

Las propiedades iniciales deben cubrir:

- Texto y títulos.
- Enlaces.
- Imagen y texto alternativo.
- Listas pequeñas, como proyectos o habilidades.
- Alineación.
- Visibilidad opcional de elementos.
- Espaciado limitado.
- Color de énfasis tomado de los tokens del tema.

No se permitirá CSS arbitrario, HTML personalizado ni JavaScript introducido por el usuario.

## Interacción

- Seleccionar un bloque desde el canvas o desde la lista lateral.
- Añadir un bloque desde un catálogo filtrable.
- Reordenar por arrastre.
- Mover hacia arriba o abajo con controles de teclado.
- Duplicar y eliminar un bloque.
- Deshacer y rehacer cambios recientes.
- Cambiar entre vista de escritorio y móvil.
- Ocultar el panel para revisar la página.

El arrastre no puede ser la única forma de ordenar. Los botones deben tener nombres accesibles y el bloque seleccionado debe ser visible con un estado de foco claro.

## Estado de guardado

El editor debe mostrar si el borrador está guardado, guardando o tiene un error. Si una petición falla, el contenido local temporal no debe desaparecer sin avisar al usuario.

## Plantillas

Una plantilla es un SiteDocument inicial más un conjunto de tokens de tema. No debe ser un segundo formato de contenido. Esto permite crear nuevas plantillas sin modificar el editor.

Las plantillas de restaurante y landing general se añadirán después de validar la primera plantilla de portafolio.
