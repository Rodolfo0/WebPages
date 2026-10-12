# Dependencias y estructura del proyecto

Este documento resume las librerías actuales y las dependencias propuestas para el constructor de sitios por bloques.

## Dependencias ya instaladas

### Aplicación

- `next`: base de la aplicación React y sus tipos de integración.
- `react`: componentes de interfaz.
- `react-dom`: renderizado de React.
- `drizzle-orm`: acceso tipado a la base de datos D1.

### Desarrollo y despliegue

- `vinext`: ejecución de la aplicación con Vite y compatibilidad con el modelo de Next.
- `vite`: servidor de desarrollo y build.
- `@vitejs/plugin-react`: integración de React con Vite.
- `@vitejs/plugin-rsc`: soporte para React Server Components.
- `@openai/sites-vite-plugin`: integración con Sites.
- `@cloudflare/vite-plugin`: integración de Vite con Cloudflare.
- `@cloudflare/workers-types`: tipos de Cloudflare Workers, D1 y R2.
- `wrangler`: desarrollo y configuración de Cloudflare.
- `drizzle-kit`: generación de migraciones y herramientas de Drizzle.

### Estilos y calidad

- `tailwindcss`: estilos utilitarios.
- `@tailwindcss/postcss`: integración de Tailwind con PostCSS.
- `typescript`: tipado estático.
- `eslint`: revisión de calidad del código.
- `eslint-config-next`: reglas de ESLint para React y Next.

## Dependencias propuestas para el producto

La exportación Astro queda fuera del MVP. Las dependencias relacionadas con ZIP y la estructura de exportación se mantienen documentadas para una fase posterior.

| Librería | Propósito |
| --- | --- |
| `zod` | Validar `SiteDocument`, formularios, peticiones, uploads y variables de entorno en tiempo de ejecución. [Documentación](https://zod.dev/) |
| `zustand` | Gestionar el estado local del editor: bloque seleccionado, vista previa, panel lateral, historial y cambios temporales. |
| `@dnd-kit/react` | Arrastrar y reordenar los bloques del canvas. |
| `@dnd-kit/helpers` | Utilidades para mover elementos en listas ordenables. [Documentación](https://dndkit.com/react/quickstart/) |
| `react-hook-form` | Gestionar formularios de autenticación, contacto y propiedades de bloques. |
| `@hookform/resolvers` | Conectar `react-hook-form` con los esquemas de Zod. |
| `@supabase/supabase-js` | Registro, inicio de sesión, sesiones, recuperación y verificación de email. |
| `@supabase/ssr` | Gestionar sesiones mediante cookies en el servidor. Su compatibilidad con Vinext y Cloudflare debe probarse antes de adoptarlo. [Documentación](https://supabase.com/docs/guides/auth/server-side) |
| `fflate` | Crear archivos ZIP para la exportación Astro dentro del runtime de Cloudflare. |
| `lucide-react` | Iconos para la navegación, los botones, el editor y los estados de la interfaz. |
| `@mantine/core` | Componentes de interfaz como botones, inputs, modales, paneles, tabs, menús y tablas. |
| `@mantine/hooks` | Hooks para media queries, hotkeys, estados de interacción y comportamiento responsive. |
| `@mantine/notifications` | Notificaciones para confirmar guardados, publicaciones, errores y acciones del editor. |

## Dependencias de pruebas

Estas dependencias deben instalarse como `devDependencies`:

- `vitest`: pruebas unitarias para documentos, bloques, slugs y reglas de publicación.
- `jsdom`: simulación del navegador para pruebas de React.
- `@vitest/coverage-v8`: medición de cobertura.
- `@testing-library/react`: pruebas de componentes desde la perspectiva del usuario.
- `@testing-library/jest-dom`: matchers para verificar el DOM.
- `@testing-library/user-event`: simulación de escritura, clics y teclado.
- `@playwright/test`: pruebas completas de autenticación, editor, publicación y vista móvil. [Documentación](https://playwright.dev/docs/browsers)

## Comandos de instalación propuestos

```bash
pnpm add zod zustand @dnd-kit/react @dnd-kit/helpers \
  react-hook-form @hookform/resolvers \
  @supabase/supabase-js @supabase/ssr \
  fflate lucide-react \
  @mantine/core @mantine/hooks @mantine/notifications

pnpm add -D vitest jsdom @vitest/coverage-v8 \
  @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event @playwright/test
```

Estos comandos sirven como referencia para dependencias propuestas que todavía no estén instaladas. Usa pnpm y conserva el lockfile canónico. La integración de Supabase Auth con Sites y Cloudflare Workers está comprobada en [el spike de autenticación](spikes/supabase-auth-sites-cloudflare.md).

Mantine se usará para los componentes funcionales de la aplicación, como el dashboard, los formularios y el panel del editor. Tailwind seguirá disponible para layouts, estilos específicos de los bloques y la apariencia de los sitios publicados. Ambos pueden convivir, siempre que se definan reglas claras para evitar estilos duplicados.

## Estructura lógica propuesta

```text
app/
  api/                       # entradas HTTP de Vinext; delegan en resources/
  ...                        # páginas y layouts
resources/
  auth/
    server/
    ui/
    tests/
      unit/
      integration/
      e2e/
  <resource>/
    ...                      # cada capacidad se agrega al implementarla
shared/                      # utilidades genuinamente compartidas
db/                          # esquema y acceso D1 compartidos, si aplica
vitest.config.ts             # configuración central, casos junto al recurso
playwright.config.ts         # configuración central, casos junto al recurso
```

### Responsabilidades principales

- `app/`: archivos de entrada que exige el router de Vinext; delegan la lógica en un recurso.
- `resources/<resource>/`: interfaz, lógica de servidor y pruebas pertenecientes a una capacidad del producto.
- `resources/<resource>/tests/`: pruebas unitarias, de integración y E2E de ese recurso.
- `shared/`: contratos y utilidades compartidas cuando más de un recurso los necesita.
- `db/`: esquema y acceso de Drizzle para D1 cuando la persistencia común lo requiera.
- La estructura interna de cada recurso crece con la necesidad; no se añaden capas vacías por anticipado.

El repositorio usa pnpm como gestor de paquetes canónico (`pnpm-lock.yaml` y `pnpm-workspace.yaml`). `package-lock.json` es heredado y no debe actualizarse en cambios rutinarios.

## Paquetes que no se instalarán inicialmente

- `bcrypt`: la autenticación no se implementará manualmente.
- `jsonwebtoken`: las sesiones serán gestionadas por el proveedor de autenticación.
- `uuid`: Cloudflare ofrece `crypto.randomUUID()`.
- `sharp`: las transformaciones de imagen quedan fuera del primer MVP.
- SDK de AWS: R2 se utilizará mediante el binding de Cloudflare.
- `astro` en la aplicación principal: Astro será una dependencia de la plantilla exportada, no del runtime principal.

Si en una fase posterior se añade Astro SSR en Cloudflare, se podrá evaluar `@astrojs/cloudflare`. No es necesario para la exportación inicial.
