# UI y estilos

Esta es la convención de estilos para el dashboard, el editor y los bloques del sitio. El dashboard y el editor aún no están implementados; las nuevas pantallas deben aplicar estas reglas desde su primera implementación.

## Aplicación: Mantine para controles, Tailwind para layout

- Usa Mantine para los controles y patrones interactivos: botones, campos, selectores, tabs, menús, diálogos, notificaciones y estados de formulario. Los componentes propios del producto deben componer estos controles, no recrear su apariencia con HTML y clases utilitarias.
- Configura tema, colores, radios y variantes de Mantine una sola vez en el proveedor de la superficie privada que contiene dashboard y editor. Mantén una convención semántica para las acciones: acción principal con `variant="filled"`, acción secundaria con `variant="default"` y acción destructiva con `color="red"`.
- Usa Tailwind para la estructura de página y el layout alrededor de los controles: grid, flex, anchos, separación, alineación, overflow y cambios responsive.
- No uses Tailwind para volver a definir el aspecto o los estados de un control Mantine. Evita aplicar sobre esos controles clases de color, fondo, borde, radio, sombra, padding, foco o estado disabled. La tipografía de la interfaz usa los componentes de texto de Mantine; Tailwind puede posicionarlos y dimensionar su contenedor.
- Coloca cada componente junto al recurso que lo posee, normalmente en `resources/<recurso>/ui/`. Crea componentes en `shared/` solo cuando exista reutilización real entre recursos; la convención visual compartida viene del tema Mantine, no de imports entre recursos.

El proveedor de Mantine pertenece al layout privado de `/app`, no al layout raíz que también pueda alojar rutas públicas. Así el shell y el tema del dashboard/editor no se convierten en dependencias del sitio publicado.

## Bloques: estilos propiedad del renderizador

- El componente de un bloque y sus estilos son una unidad. Usa clases con alcance al bloque mediante CSS Modules o una hoja de estilos propia del renderizador; no dependas de selectores globales del dashboard.
- Los bloques reciben contenido y tokens del tema desde `SiteDocument`. Su apariencia no depende del tema de Mantine, de componentes Mantine ni de clases del shell privado.
- El canvas del editor reutiliza el mismo componente React del bloque que usa el renderizador público. El editor aporta controles de selección fuera del contenido del bloque; no modifica ni reemplaza su skin.
- Si un bloque usa utilidades Tailwind, el paquete de estilos del renderizador público debe incluir el CSS generado para esas utilidades. No basta con que Tailwind esté cargado por el dashboard. La futura exportación Astro debe incluir los estilos equivalentes de los bloques que exporta.
- Mantén los estilos de aplicación y los estilos públicos en entradas separadas. Cada renderizador importa los estilos que necesita; ningún bloque importa CSS del dashboard para completar su presentación.

## Patrón para una pantalla funcional

```tsx
<MantineProvider theme={appTheme}>
  <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
    <ProjectActions>
      <Button variant="filled">Crear proyecto</Button>
    </ProjectActions>
  </main>
</MantineProvider>
```

El ejemplo usa Tailwind para el layout, Mantine para la acción y un componente propio para el concepto de producto. `appTheme` se define una sola vez y se comparte entre las pantallas privadas; los bloques públicos no lo consumen.
