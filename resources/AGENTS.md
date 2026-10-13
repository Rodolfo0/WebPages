# Instrucciones para los recursos

Cada carpeta directa de `resources/` representa una capacidad o dominio del producto. Mantén sus componentes, lógica y pruebas cerca del recurso que los posee.

## Estructura

- Usa subcarpetas por responsabilidad cuando aporten claridad, como `ui/`, `server/`, `domain/` y `application/`. No agregues capas vacías para anticipar necesidades.
- Mantén páginas y route handlers que requiere Vinext en `app/`; deben delegar en el recurso correspondiente.
- Guarda pruebas en `resources/<resource>/tests/{unit,integration,e2e}/`. Los archivos de configuración de Vitest y Playwright se mantienen en la raíz.
- Si varios recursos necesitan la misma lógica, muévela a `shared/` en vez de importar archivos internos entre recursos.

## Pruebas

- `unit/`: reglas, handlers y componentes aislados; usa Vitest y React Testing Library, con JSDOM solo para pruebas de DOM.
- `integration/`: interacción del recurso con el runtime local Cloudflare Worker y servicios externos necesarios.
- `e2e/`: recorridos de usuario con Playwright. Ubica un flujo que cruce recursos junto al recurso dueño del flujo principal.
- Prefiere consultas accesibles por rol, etiqueta o texto y verifica comportamiento observable.
- Para integración y E2E de autenticación usa un proyecto Supabase dedicado, configurado mediante `.env.test.local`. No uses claves `service_role`, cuentas personales ni secretos reales en fixtures.
- Los E2E actuales usan una cuenta confirmada para login, validación de sesión y logout. No agregues registro de cuentas ni apertura de correo a esos E2E salvo que el issue lo solicite explícitamente.
- No debilites una prueba para ocultar incompatibilidades del runtime o del proveedor; documenta el requisito o límite observado.

Consulta `docs/09-pruebas-y-roadmap.md` para los comandos y la configuración local.
