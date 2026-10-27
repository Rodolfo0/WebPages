# Arquitectura React

## Responsabilidades

React cubrirá tres superficies relacionadas:

1. El panel privado donde el usuario administra sus proyectos.
2. El editor visual de un proyecto.
3. El renderizador de la versión pública administrada.

Las tres superficies deben consumir el mismo SiteDocument. El editor no debe producir un formato distinto al que usa la publicación.

El contrato canónico vive en `resources/site-document` y expone su API pública desde `index.ts`. El editor, la publicación y cualquier exportador deben importar ese punto de entrada; no deben mantener tipos ni validadores paralelos.

El dashboard y el editor comparten la convención de controles descrita en [UI y estilos](12-ui-y-estilos.md). El renderizador público tiene su propia entrada de estilos; no monta el shell ni el tema de Mantine del área privada.

## Organización lógica

La estructura sigue una arquitectura por recursos (Screaming Architecture): el primer nivel después de las rutas nombra las capacidades del producto, y cada recurso contiene su implementación y sus pruebas.

`app/` conserva las entradas que requiere Vinext: páginas, layouts y route handlers. Esas entradas componen la interfaz o delegan las solicitudes; las reglas de negocio pertenecen al recurso.

```text
app/
  api/auth/.../route.ts       # adapters del router hacia el recurso auth
  auth/callback/route.ts
  page.tsx
resources/
  auth/
    domain/                   # AuthUser, contrato del adaptador y errores internos
    server/                   # API pública, sesiones, handlers y proveedor
    ui/                       # Interfaz propia de autenticación
    tests/
      unit/
      integration/
      e2e/
  projects/
    domain/                   # reglas de permisos y acceso por proyecto
    server/                   # consultas de membresía y autorización
  <resource>/
    ...                       # se crea al implementar esa capacidad
shared/                       # código realmente compartido entre recursos
database/
  d1/                         # esquema, acceso, configuración y migraciones D1
  supabase/                   # configuración y migraciones PostgreSQL de Auth
```

Cada carpeta de `resources/<resource>/` puede organizarse por responsabilidad —por ejemplo, `server/`, `ui/`, `domain/` o `application/`— según lo necesite el recurso. No se crean carpetas vacías ni capas sin uso.

Las pruebas viven junto al recurso que posee el comportamiento. Un recorrido E2E entre varios recursos se coloca en el recurso dueño del flujo principal. `shared/` contiene solo código agnóstico usado por más de un recurso; un recurso no debe importar detalles privados de otro.

`auth`, `projects`, `site-document`, `blocks` y `editor` son los recursos implementados hasta ahora. El recurso `editor` posee la interfaz del canvas, la lista lateral, el catálogo y la selección local; obtiene el borrador validado desde `projects/server`. El guardado del borrador se añade en su issue correspondiente. La publicación seguirá siendo un recurso separado.

La autenticación expone `resources/auth/server` como API de servidor y `resources/auth` como contrato de identidad. Las superficies privadas reciben `AuthUser` mediante `withAuthUser()`; las dependencias de Supabase permanecen en la implementación del proveedor. El formulario privado de cambio de contraseña consume ese mismo tipo.

## Rutas principales

    /login
    /register
    /app/projects
    /app/projects/:projectId/editor
    /app/projects/:projectId/messages
    /s/:slug

Las rutas privadas comprueban la sesión con `withAuthUser()` y autorizan cada operación por membresía activa y permiso en el servidor; las lecturas y escrituras incluyen esa regla en la consulta del recurso. Nunca usan `created_by` como concesión de acceso. La ruta pública lee solo la versión publicada, no expone el borrador y solo sirve assets incluidos en la lista de referencias validada y guardada con ese snapshot.

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
