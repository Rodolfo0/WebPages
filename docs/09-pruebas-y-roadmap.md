# Pruebas y roadmap

## Comandos de prueba

Los tres niveles se ejecutan por separado:

```sh
pnpm test:unit
pnpm test:integration
pnpm test:e2e
```

- `test:unit` descubre pruebas Vitest en los recursos. Usa Node para reglas y
  handlers; las pruebas de componentes pueden seleccionar JSDOM y React
  Testing Library.
- `test:integration` levanta Vinext con el runtime local de Cloudflare en el
  puerto `5180` y llama la ruta real de login contra el proyecto Supabase de
  prueba. Usa credenciales incorrectas deliberadamente, por lo que no crea una
  cuenta.
- `test:e2e` recorre la interfaz con Playwright: inicia sesión con una cuenta de
  prueba ya confirmada, valida la sesión en el servidor y cierra sesión. No crea
  cuentas ni envía correos.

### Ubicación de las pruebas

Cada recurso contiene sus pruebas en `resources/<resource>/tests/`. Las
subcarpetas indican el nivel:

```text
resources/auth/tests/
  unit/
  integration/
  e2e/
```

La configuración de Vitest y Playwright permanece en la raíz, pero los casos de
prueba pertenecen al recurso que posee el comportamiento. Un E2E que cruce
varios recursos se guarda junto al recurso dueño del flujo principal.

### Configuración de integración y E2E

1. Crea o elige un proyecto Supabase desechable, distinto al de desarrollo y
   producción. Habilita Email/Password y deja activada la confirmación de
   correo.
2. Copia `.env.test.example` a `.env.test.local` y asigna la URL y la clave
   publicable de ese proyecto. El archivo local está ignorado por Git.
3. Crea una cuenta de prueba en ese proyecto, confirma su correo una sola vez y
   añade su email y contraseña a `SUPABASE_E2E_EMAIL` y
   `SUPABASE_E2E_PASSWORD` en `.env.test.local`.
4. Ejecuta los comandos por separado. Playwright administra el Worker de prueba
   en el puerto `5180`. Puede convivir con `pnpm dev`, que Vinext ejecuta en
   el puerto `3000` por defecto.
   Si Playwright no encuentra Chromium en el equipo, instala el navegador con
   `pnpm exec playwright install chromium`.

El test de integración solo requiere las dos variables del proyecto. El E2E de
login también requiere la cuenta confirmada. No guardes una clave `service_role`
ni uses cuentas personales.

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

### Fase 4: cierre del MVP

- Pruebas unitarias, de integración y E2E.
- Revisión de autorización y validaciones de seguridad.
- Validación del build React y del despliegue.
- Verificación del flujo completo de registro a publicación y mensajes.

### Fase 5: exportación posterior al MVP

- Plantilla Astro.
- Renderizadores Astro de los bloques iniciales.
- ZIP descargable.
- Pruebas de build y ausencia de secretos.

### Fase 6: expansión

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
