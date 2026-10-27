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

El contrato vive en `resources/blocks`. `BlockDefinition<P>` describe un tipo de bloque y su renderizador React:

    type BlockDefinition<P> = {
      type: string
      label: string
      description: string
      propsSchema: ZodType<P>
      defaultProps: P
      reactComponent: ComponentType<BlockRenderProps<P>>
      assetIdsFromProps?: (props: P) => readonly string[]
    }

La definición centraliza el nombre del bloque, sus valores iniciales, su validación y su renderizador. `defineBlock()` comprueba en tiempo de compilación que `reactComponent` acepta exactamente las props que produce `propsSchema`.

Un renderizador recibe dos cosas separadas: su propio contenido validado en `props` y un contexto de render con `blockId`, `theme` y un `onAction` opcional para el editor. La separación evita que las props del bloque tengan que admitir callbacks dentro de su tipo JSON.

El registro entrega `propsSchema` y `defaultProps` a `createSiteDocumentSchema` desde `resources/site-document`. `toBlockSchemaRegistry()` proyecta el registro a esa forma, de modo que el documento se valide con la misma fuente que usa el renderizador. El schema valida los valores iniciales al crear el validador, los aplica cuando faltan props en una instancia y rechaza props adicionales. Los consumidores deben validar el documento completo con el registro, para que también se rechacen tipos de bloque desconocidos: `requireBlock()` lanza `UnknownBlockTypeError` si el tipo no existe.

Cada bloque es dueño de sus estilos. Su renderizador React debe conservar la misma apariencia en la vista pública y en el canvas, sin importar estilos del dashboard o depender de Mantine. Consulta [UI y estilos](12-ui-y-estilos.md) para la convención de aislamiento y el uso de tokens del tema.

### Renderizador Astro posterior al MVP

`BlockDefinition` no incluye hoy un renderizador Astro. El MVP solo renderiza React, así que la exportación añade su renderizador como una propiedad nueva de la misma definición cuando llegue [la generación de Astro](08-generacion-astro.md), sin modificar `SiteDocument`, el editor ni el registro. `resources/blocks/index.ts` es el punto de entrada que consumirán el editor, la publicación y el exportador.

## Catálogo registrado

Los ocho bloques de la plantilla están implementados en `resources/blocks/ui/portfolio` y reunidos en `portfolioBlockRegistry`, que `resources/blocks/index.ts` exporta junto con cada definición:

- `hero`: titular, introducción, imagen opcional y una llamada a la acción. Es el único bloque que emite el `h1`; el resto empieza en `h2`.
- `about`: biografía y retrato opcional.
- `experience`: puestos con periodo, descripción y enlace opcional.
- `projects`: tarjetas de proyecto con imagen, resumen y enlace. Es el bloque que más assets referencia.
- `skills`: lista plana de etiquetas, sin niveles ni porcentajes.
- `testimonials`: opiniones opcionales; la plantilla lo emite con `hidden: true`.
- `contact`: email, teléfono, ubicación y redes sociales.
- `footer`: copyright y enlaces finales.

`createPortfolioTemplate` resuelve cada tipo con `requireBlock(portfolioBlockRegistry, type)`, así que un tipo sin registrar falla al construir la plantilla con `UnknownBlockTypeError` en lugar de producir un documento inválido. Las props se emiten completas: la plantilla parte de los `defaultProps` de cada bloque y aplica encima solo el contenido propio. Un documento nuevo pasa `createSiteDocumentSchema` desde el primer momento, y añadir un bloque al catálogo no obliga a tocar los demás.

El vocabulario de props es común y vive en `resources/blocks/domain/shared-props.ts`: texto y títulos, enlaces, imagen con texto alternativo, listas pequeñas, alineación, visibilidad, espaciado limitado y color de énfasis. Los enlaces se limitan a `http://`, `https://`, una ruta interna que empieza por `/` o un ancla que empieza por `#`, de modo que un documento no puede introducir `javascript:` ni otro esquema ejecutable.

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
