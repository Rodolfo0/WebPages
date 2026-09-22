# Arquitectura React

## Responsabilidades

React cubrirá tres superficies relacionadas:

1. El panel privado donde el usuario administra sus proyectos.
2. El editor visual de un proyecto.
3. El renderizador de la versión pública administrada.

Las tres superficies deben consumir el mismo SiteDocument. El editor no debe producir un formato distinto al que usa la publicación.

## Organización lógica

La estructura puede organizarse por dominio, no por tipo genérico de archivo:

    src/
      app/                 Rutas y composición de páginas
      features/projects/   Lista, creación y configuración de proyectos
      features/editor/     Canvas, panel, selección y autosave
      features/publishing/Estado de publicación y exportación
      blocks/              Registro y renderizadores de bloques
      server/              Autorización, consultas y operaciones de escritura
      lib/site-document/   Tipos, validación y migraciones del documento

Los nombres pueden cambiar según el starter elegido. La separación importante es que la validación, la autorización y el documento canónico no vivan únicamente dentro de componentes de interfaz.

## Rutas principales

    /login
    /register
    /app/projects
    /app/projects/:projectId/editor
    /app/projects/:projectId/messages
    /s/:slug

Las rutas privadas deben comprobar sesión y propiedad en el servidor. La ruta pública debe leer solo la versión publicada y no exponer el borrador.

## Estado del editor

Separar el estado en tres niveles:

- Estado del servidor: proyecto, borrador, versión publicada, assets y estado de guardado.
- Estado de edición: bloque seleccionado, panel abierto, modo de vista previa, historial de cambios y estado de arrastre.
- Preferencias locales: ancho de vista previa, última pestaña abierta y otras preferencias no autoritativas.

El navegador puede mantener cambios temporales para una interacción fluida, pero el borrador persistente debe guardarse en el servidor. localStorage no será la fuente de verdad del proyecto.

## Guardado

- Guardar después de una pausa breve al editar una propiedad.
- Mostrar estados claros: guardando, guardado y error.
- Evitar enviar el documento completo para cada cambio si el tamaño crece. El primer MVP puede enviar el documento completo y evolucionar a operaciones parciales después de medir.
- Rechazar versiones antiguas para evitar que una pestaña abierta sobrescriba cambios más recientes.

## Publicación

Publicar debe ser una operación explícita:

1. Validar el borrador.
2. Crear un snapshot inmutable.
3. Marcar el snapshot como publicado.
4. Invalidar la caché de la URL pública.

El borrador puede continuar cambiando después de publicar. La página pública no debe reflejar esos cambios hasta la siguiente publicación.
