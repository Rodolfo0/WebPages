# Pruebas y roadmap

## Pruebas unitarias

- Validación de SiteDocument.
- Valores por defecto de cada bloque.
- Rechazo de tipos y propiedades desconocidas.
- Normalización de slugs.
- Migración entre versiones del documento.
- Resolución de assets referenciados.
- Conversión del documento a datos Astro.

## Pruebas de integración

- Registro y sesión con el proveedor elegido.
- Creación y lectura de proyectos propios.
- Rechazo de proyectos ajenos.
- Guardado y conflicto de versiones.
- Publicación de un snapshot.
- Subida y asociación de imágenes.
- Recepción de mensajes.
- Generación y descarga de ZIP.

## Pruebas de interfaz

- Crear proyecto desde plantilla.
- Añadir y eliminar bloques.
- Editar una propiedad.
- Reordenar con mouse.
- Reordenar con teclado.
- Cambiar entre vistas de escritorio y móvil.
- Recuperar una sesión expirada sin perder el borrador temporal.
- Mostrar correctamente los estados de guardado y publicación.

## Pruebas de publicación

- La ruta pública no muestra borradores.
- Un slug inexistente devuelve una página de error apropiada.
- El HTML inicial contiene título y descripción del sitio.
- La publicación nueva reemplaza la anterior.
- El export Astro contiene todos los assets referenciados.
- El ZIP no incluye secretos ni archivos generados por el usuario.
- Dos proyectos no pueden reclamar la misma combinación de dominio y ruta cuando se habilite esa función.

## Fases sugeridas

### Fase 1: base del producto

- Scaffold React y despliegue base.
- Autenticación gestionada.
- D1 y R2.
- Modelo SiteDocument.
- Dashboard de proyectos.

### Fase 2: editor

- Canvas.
- Panel de propiedades.
- Catálogo de bloques de portafolio.
- Autosave.
- Reordenamiento accesible.

### Fase 3: publicación

- Snapshot publicado.
- Ruta pública React.
- SEO básico.
- Formulario y bandeja interna.

### Fase 4: exportación

- Plantilla Astro.
- Renderizadores Astro de los bloques iniciales.
- ZIP descargable.
- Pruebas de build.

### Fase 5: expansión

- Plantillas de restaurante y landing general.
- Dominios propios.
- Subdominios.
- Subrutas bajo dominio propio compartido.
- Astro SSR o builds estáticos por sitio si los datos de uso justifican el coste.

## Decisiones que conviene revisar después del MVP

- ¿Los usuarios necesitan colaboración o solo propiedad individual?
- ¿La bandeja interna necesita respuestas, etiquetas o notificaciones?
- ¿El formulario requiere email, captcha o moderación?
- ¿La exportación Astro debe generar solo código fuente o también un build listo para desplegar?
- ¿La publicación React entrega suficiente HTML inicial y rendimiento?
- ¿Los dominios deben ser gratuitos mediante subdominios o parte de un plan de pago?
- ¿Qué límites de almacenamiento e imágenes cubren el uso real?
