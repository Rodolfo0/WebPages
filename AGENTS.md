# Instrucciones del proyecto

## Arquitectura

- Antes de cambiar una capacidad, consulta los documentos relacionados en `docs/`; `docs/02-arquitectura-react.md`, `docs/04-autenticacion-y-seguridad.md` y `docs/09-pruebas-y-roadmap.md` describen las decisiones vigentes.
- `app/` contiene las entradas que exige Vinext. Las páginas componen recursos y las rutas HTTP delegan en ellos; mantén la lógica de negocio dentro de `resources/<resource>/`.
- Organiza el primer nivel por capacidades del producto. No crees recursos vacíos ni carpetas genéricas por tipo de archivo.
- Coloca en `shared/` solo código realmente reutilizado por más de un recurso. Evita dependencias entre los detalles internos de recursos.
- Si un cambio altera arquitectura, seguridad, configuración o comandos, actualiza el documento pertinente.

## Runtime, seguridad y dependencias

- La aplicación se ejecuta en Cloudflare Workers mediante Vinext. Evita APIs exclusivas de Node dentro del runtime; los bindings de Cloudflare se obtienen en las entradas de `app/` y se pasan al recurso.
- La autenticación usa Supabase gestionado y `@supabase/ssr`. No implementes almacenamiento de contraseñas, hashes, JWT ni sesiones propias.
- No expongas tokens o secretos al cliente ni los incluyas en logs, commits o archivos de ejemplo. Usa placeholders en ejemplos y variables locales ignoradas por Git.
- Usa pnpm como gestor canónico porque el repositorio mantiene `pnpm-lock.yaml` y `pnpm-workspace.yaml`. `package-lock.json` es un archivo heredado del scaffold: no lo regeneres ni lo actualices durante cambios rutinarios de dependencias; elimínalo solo dentro de una limpieza explícita.
- Respeta Node.js `>=22.13.0`, declarado en `package.json`.

## Comandos

- Desarrollo: `pnpm dev`
- Lint: `pnpm lint`
- Build: `pnpm build`
- Pruebas unitarias, integración y E2E: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`

Los requisitos de las suites y las variables de prueba están en `docs/09-pruebas-y-roadmap.md`. Informa qué comandos ejecutaste al terminar un cambio.
