# Constructor de sitios por bloques

La documentación detallada de cada área está en [docs/README.md](docs/README.md).

## Resumen

Crear una aplicación web para usuarios externos que permita:

- Registrarse con email y contraseña.
- Crear varios proyectos.
- Construir páginas de portafolio/CV mediante bloques predefinidos.
- Reordenar bloques desde un canvas.
- Editar propiedades limitadas desde un panel lateral.
- Subir y reutilizar imágenes.
- Publicar cada sitio en una subruta pública, por ejemplo `/s/mi-portafolio`.
- Recibir mensajes del formulario de contacto en una bandeja interna.
- Exportar el sitio usando una plantilla Astro.

El editor y la publicación pública usarán React. Astro funcionará como formato de exportación para evitar generar un build separado en cada publicación.

## Cambios principales

- Construir el editor con React y una interfaz de canvas, panel lateral y vista previa responsive.
- Definir un esquema versionado `SiteDocument` como fuente única para React y Astro.
- Crear un registro de bloques con:
  - Presentación.
  - Sobre mí.
  - Experiencia.
  - Proyectos.
  - Habilidades.
  - Testimonios.
  - Contacto.
  - Redes sociales.
  - Pie de página.
- Limitar cada bloque a propiedades controladas: textos, enlaces, imágenes, colores del tema, alineación y espaciado.
- Añadir reordenamiento por arrastre y controles equivalentes para teclado.
- Guardar borradores automáticamente y crear una versión inmutable al publicar.
- Usar D1 para usuarios, proyectos, documentos, versiones y mensajes.
- Usar R2 para imágenes y archivos exportados.
- Validar todos los documentos y cambios del editor en el servidor.
- Verificar permisos del propietario en cada operación privada.
- Servir únicamente la versión publicada en las URLs públicas.
- Añadir protección básica al formulario público mediante honeypot, validación y límite de envíos.
- Integrar la autenticación mediante una librería o servicio reconocido y mantenido, sin crear desde cero el registro, el hashing de contraseñas, las sesiones, la recuperación de acceso ni la verificación de email.
- Crear un exportador Astro que genere:
  - `src/pages/index.astro`.
  - Datos del sitio en JSON.
  - Estilos y tokens del tema.
  - Imágenes usadas.
  - Configuración mínima para ejecutar el proyecto Astro.

Modelo base:

```ts
type SiteDocument = {
  version: 1
  site: {
    title: string
    slug: string
    description?: string
    theme: ThemeTokens
  }
  pages: PageDocument[]
}

type PageDocument = {
  id: string
  path: string
  blocks: BlockInstance[]
}

type BlockInstance = {
  id: string
  type: string
  props: Record<string, unknown>
}
```

## Generación de Astro y decisión arquitectónica

Astro se usará como formato de salida y no como requisito para cada publicación. El editor conservará un único documento `SiteDocument`; React lo utilizará para el editor y para la URL administrada, mientras que el exportador lo convertirá en un proyecto Astro.

### Flujo de exportación

1. El usuario solicita exportar una versión publicada.
2. El servidor obtiene el snapshot inmutable y valida su versión del esquema.
3. El exportador identifica los bloques usados, los assets asociados y los datos SEO.
4. Se copia una plantilla Astro fija. El contenido se escribe como JSON, no como código generado desde texto del usuario.
5. La plantilla carga el JSON y renderiza los bloques mediante componentes Astro conocidos.
6. Las imágenes se copian a `public/assets/` usando nombres derivados de su hash.
7. Se genera un `README.md` con instrucciones de instalación, build y configuración del formulario.
8. Se crea un ZIP y se guarda en R2 para descargarlo sin repetir el proceso.

El registro de bloques debe mantener el mismo contrato en ambos renderizadores:

```ts
type BlockDefinition = {
  type: string
  propsSchema: unknown
  reactComponent: unknown
  astroComponentPath: string
}
```

La plantilla Astro tendrá un componente por bloque y rechazará tipos desconocidos. No se permitirá que el contenido del usuario genere archivos `.ts`, `.js` o componentes ejecutables. Esto reduce el riesgo de inyección y hace que el exportador sea predecible.

### Qué se publica en el MVP

- La URL administrada, por ejemplo `/s/mi-portafolio`, se renderiza con React usando únicamente la versión publicada.
- La exportación Astro se ejecuta bajo demanda y se descarga como proyecto independiente.
- El formulario con bandeja interna está garantizado para la URL administrada.
- El export Astro incluirá enlaces de contacto por defecto. Un formulario conectado a la bandeja interna requerirá configurar en el proyecto exportado la URL pública de recepción, el identificador del sitio y las variables necesarias. No se intentará incluir credenciales privadas dentro del ZIP.

### Dominios en una fase posterior

La primera versión publicará los proyectos mediante subrutas administradas. El modelo de publicación debe reservar desde el inicio una configuración de dominio que permita añadir después:

- Un dominio propio asociado a un proyecto, por ejemplo `www.estudio-ejemplo.com`.
- Un dominio compartido por la plataforma con subdominios por proyecto, por ejemplo `mi-portafolio.producto.com`.
- Un dominio propio compartido entre varios proyectos mediante subrutas, por ejemplo `misitio.com/portafolio` y `misitio.com/restaurante`.

La resolución de una petición deberá buscar el proyecto por dominio y subruta, dominio y subdominio, o únicamente por la subruta administrada del MVP. La configuración futura deberá contemplar unicidad de dominios y rutas, estado de verificación, redirección HTTPS y asociación segura con el propietario. La compra de dominios, la configuración DNS, la emisión de certificados y la interfaz de verificación quedan fuera del MVP.

### Alternativas descartadas para la primera versión

- **Un build Astro por cada publicación.** Produce HTML estático y buen rendimiento, pero requiere una cola de builds, almacenamiento de artefactos, invalidación de caché y un proceso separado cada vez que el usuario publica. También complica la publicación inmediata y aumenta el coste operativo.
- **Un único Astro estático para todos los usuarios.** En modo estático, Astro necesita conocer las rutas dinámicas durante el build mediante `getStaticPaths()`. Cada nuevo slug obligaría a regenerar el conjunto de sitios.
- **Un Astro SSR compartido.** Es viable para una segunda etapa con una ruta dinámica como `[...slug].astro` y el adaptador oficial de Cloudflare, pero introduce un segundo runtime junto al editor React, además de resolver bindings, sesiones, caché y rutas públicas.

### Decisión

Astro sí vale la pena como exportador porque permite entregar un proyecto portable y mantiene abierta la posibilidad de desplegar sitios estáticos más adelante. No vale la pena usarlo como motor de publicación del MVP: React reduce la cantidad de runtimes y permite publicar una nueva versión sin ejecutar un build independiente por sitio.

Si el producto demuestra que los sitios necesitan SEO avanzado, rendimiento estático o despliegues fuera de la plataforma, se añadirá una segunda fase con Astro SSR compartido o builds estáticos por sitio. Esa fase reutilizará el mismo `SiteDocument` y el mismo registro de bloques.

## Autenticación y seguridad

- Usar Supabase Auth y su SDK oficial como opción principal para email, contraseña, sesiones, recuperación de acceso y verificación de email.
- Mantener la integración detrás de un adaptador de autenticación para poder cambiar de proveedor sin reescribir el editor ni la lógica de proyectos.
- No implementar autenticación propia ni guardar contraseñas, hashes, tokens de sesión o códigos de recuperación en D1.
- Validar la sesión en el servidor para cada operación privada. La interfaz no será la fuente de autorización.
- Asociar cada proyecto, imagen y mensaje al identificador externo del usuario autenticado.
- Aplicar autorización por propietario en todas las rutas de lectura, escritura, subida y exportación.
- Mantener las claves privadas y secretos únicamente en variables protegidas del entorno de despliegue.
- Revisar compatibilidad del SDK con el runtime de Sites antes de implementarlo. Si no es compatible, usar otra librería de autenticación reconocida que soporte el mismo flujo, sin reemplazarla por código propio.

## Pruebas y criterios de aceptación

- El usuario puede registrarse, iniciar sesión y recuperar acceso.
- El flujo de autenticación usa la librería o servicio elegido, incluyendo sus mecanismos seguros de sesión y recuperación.
- Una sesión ausente, inválida o expirada no permite acceder a datos privados ni ejecutar acciones protegidas.
- Un usuario no puede leer ni modificar proyectos ajenos.
- Puede crear un proyecto desde una plantilla de portafolio.
- Puede añadir, editar, ocultar y reordenar bloques.
- El orden se conserva después de recargar.
- Las imágenes subidas quedan asociadas al proyecto correcto.
- Un documento inválido no se puede guardar ni publicar.
- Publicar crea una versión inmutable.
- La URL pública solo muestra contenido publicado.
- El formulario guarda mensajes en la bandeja del propietario.
- La página pública funciona en móvil y escritorio.
- Los controles principales funcionan con teclado.
- El exportador genera un proyecto Astro válido usando el mismo `SiteDocument`.
- Se verifican colisiones de slug, archivos no permitidos, imágenes demasiado grandes y envíos abusivos.
- El build de React y el flujo de exportación Astro terminan correctamente.

## Supuestos y límites

- La primera versión se centra en portafolios y curriculums. Los bloques específicos de restaurantes se añadirán después.
- No habrá edición libre de HTML, CSS ni JavaScript.
- No habrá dominios personalizados, colaboración entre usuarios, analítica ni pagos en el MVP.
- La URL pública usará una subruta administrada, no subdominios.
- En una fase posterior se podrá asociar un dominio propio a cada proyecto, usar subdominios de un dominio compartido o servir varios proyectos como subrutas de un dominio propio compartido.
- El proveedor de autenticación gestionada debe estar disponible antes de implementar el acceso público.
- Astro será una salida exportable y reutilizable. Si la generación de archivos resulta incompatible con el runtime de Sites, la publicación seguirá usando React sin duplicar la lógica de bloques.
