# Backlog de issues del MVP

Este documento convierte la propuesta del producto en issues descriptivos. Cada issue representa un resultado que se puede revisar y marcar como terminado.

El MVP debe permitir que una persona cree un portafolio, lo edite mediante bloques, lo publique en una subruta y reciba mensajes desde la página pública.

## Convenciones sugeridas

- `epic`: grupo funcional.
- `feature`: funcionalidad de producto.
- `spike`: investigación o decisión técnica.
- `test`: cobertura y validación.
- `security`: controles de acceso y datos.
- `P0`: necesario para el MVP.
- `P1`: importante, pero puede seguir después del primer flujo completo.

## Orden general

```text
Decisiones y base técnica
        |
        v
Datos y autenticación
        |
        v
Proyectos y editor
        |
        +----> Imágenes y formularios
        |
        v
Publicación
        |
        v
Validación completa del MVP
```

## Hito 0: decisiones y base técnica

### Issue 1. Validar compatibilidad de Supabase Auth con Sites y Cloudflare

- Tipo: `spike`, `P0`
- Objetivo: confirmar que el proveedor elegido funciona dentro del runtime actual.
- Dependencias: ninguna.

Criterios de aceptación:

- Se prueba registro, inicio de sesión, cierre de sesión y validación de sesión en el servidor.
- Se verifica recuperación y confirmación de email, según las capacidades del proveedor.
- Se documentan límites o incompatibilidades con Sites y Cloudflare.
- Si Supabase no es viable, se documenta una alternativa gestionada.
- No se implementan contraseñas, hashes ni sesiones propias.

### Issue 2. Configurar pruebas unitarias, integración y E2E

- Tipo: `test`, `P0`
- Objetivo: dejar disponibles Vitest, Testing Library y Playwright.
- Dependencias: ninguna.

Criterios de aceptación:

- Existen comandos separados para pruebas unitarias, integración y E2E.
- El entorno JSDOM funciona para componentes React.
- Cada nivel tiene al menos una prueba ejecutable.
- El lint y el build siguen funcionando.

### Issue 3. Definir reglas de UI entre Mantine y Tailwind

- Tipo: `chore`, `P1`
- Objetivo: evitar estilos duplicados y decisiones inconsistentes en el dashboard y el editor.
- Dependencias: ninguna.

Criterios de aceptación:

- Se documenta cuándo usar Mantine y cuándo usar Tailwind.
- Los componentes funcionales del dashboard siguen una convención común.
- Los bloques publicados pueden conservar sus estilos sin depender del dashboard.

## Hito 1: base del producto

### Issue 4. Definir y validar `SiteDocument` versión 1

- Tipo: `feature`, `P0`
- Objetivo: crear el documento canónico que consumirán el editor y la publicación, dejando preparada su reutilización futura.
- Dependencias: Issue 2.

Criterios de aceptación:

- El documento contiene sitio, tema, páginas y bloques.
- Se validan tipos, propiedades y valores iniciales.
- Se rechazan bloques o propiedades desconocidas.
- Se documenta cómo migrar documentos a versiones futuras.

### Issue 5. Crear esquema D1 y migraciones del MVP

- Tipo: `feature`, `P0`
- Objetivo: persistir usuarios, proyectos, versiones, assets y mensajes.
- Dependencias: Issue 4.

Criterios de aceptación:

- Existen tablas para `users`, `projects`, `site_versions`, `assets` y `form_submissions`.
- Los proyectos se relacionan con un propietario.
- Los slugs tienen la unicidad necesaria.
- Las versiones publicadas no se modifican.
- D1 conserva metadata de assets, mientras R2 conserva sus bytes.
- Existen índices para propietario, slug, proyecto, estado y fecha.

### Issue 6. Implementar el adaptador de autenticación

- Tipo: `feature`, `P0`
- Objetivo: ocultar el proveedor de autenticación detrás de una interfaz interna.
- Dependencias: Issue 1.

Criterios de aceptación:

- La aplicación dispone de operaciones equivalentes a `getUser`, `requireUser` y `signOut`.
- Funcionan registro, inicio de sesión, cierre de sesión y recuperación.
- Se detectan sesiones expiradas o inválidas.
- Las superficies privadas reciben un usuario autenticado, no un objeto específico del proveedor.

### Issue 7. Aplicar autorización por propietario

- Tipo: `security`, `P0`
- Objetivo: impedir el acceso a recursos ajenos aunque el usuario manipule las peticiones.
- Dependencias: Issues 5 y 6.

Criterios de aceptación:

- Cada consulta privada valida el propietario en el servidor.
- Un usuario no puede leer ni modificar proyectos ajenos.
- La regla se aplica también a assets, mensajes, publicaciones y exportaciones.
- Manipular un `projectId` no permite acceder a otro proyecto.
- Los logs de error no guardan contraseñas, tokens ni contenido sensible innecesario.

### Issue 8. Crear dashboard y CRUD de proyectos

- Tipo: `feature`, `P0`
- Objetivo: permitir administrar varios proyectos propios.
- Dependencias: Issues 5, 6 y 7.

Criterios de aceptación:

- El usuario puede listar, crear, editar y eliminar sus proyectos.
- Puede crear un proyecto desde la plantilla de portafolio.
- Cada proyecto recibe un nombre y un slug válidos.
- El dashboard muestra si existe borrador y si hay una versión publicada.

## Hito 2: editor por bloques

### Issue 9. Crear registro de bloques y contrato React

- Tipo: `feature`, `P0`
- Objetivo: centralizar definición, validación y renderizado React de cada bloque, con una extensión futura para Astro.
- Dependencias: Issue 4.

Criterios de aceptación:

- Cada bloque tiene tipo, etiqueta, descripción y props por defecto.
- Cada bloque tiene un esquema de validación.
- El registro conoce el renderizador React y deja un punto claro para añadir un renderizador Astro después del MVP.
- Un tipo desconocido se rechaza de forma segura.

### Issue 10. Implementar los bloques iniciales de portafolio

- Tipo: `feature`, `P0`
- Objetivo: ofrecer una plantilla completa de portafolio o curriculum.
- Dependencias: Issue 9.

Bloques incluidos:

- Hero o presentación.
- Sobre mí.
- Experiencia profesional.
- Proyectos destacados.
- Habilidades.
- Testimonios opcionales.
- Contacto y redes sociales.
- Pie de página.

Criterios de aceptación:

- Cada bloque tiene una composición terminada.
- Se pueden editar textos, enlaces, imágenes y opciones visuales permitidas.
- No se permite HTML, CSS ni JavaScript arbitrario.
- La plantilla inicial produce un portafolio navegable.

### Issue 11. Construir canvas, selección y catálogo de bloques

- Tipo: `feature`, `P0`
- Objetivo: permitir editar el documento desde una interfaz visual por secciones.
- Dependencias: Issues 8 y 9.

Criterios de aceptación:

- El usuario puede seleccionar un bloque desde el canvas o desde una lista lateral.
- Puede añadir bloques desde un catálogo.
- El bloque seleccionado tiene un estado visual y de foco claro.
- El catálogo puede filtrarse.

### Issue 12. Construir panel de propiedades validado

- Tipo: `feature`, `P0`
- Objetivo: editar las propiedades permitidas de cada bloque sin exponer complejidad innecesaria.
- Dependencias: Issues 9 y 11.

Criterios de aceptación:

- El usuario puede editar textos, enlaces, imágenes, alineación, visibilidad y espaciado permitido.
- Los cambios pasan por el esquema del bloque.
- Los valores inválidos muestran un error comprensible.
- El contenido temporal no desaparece si falla una petición.

### Issue 13. Agregar reordenamiento y acciones accesibles

- Tipo: `feature`, `P0`
- Objetivo: permitir modificar el orden y la composición del sitio con mouse o teclado.
- Dependencias: Issue 11.

Criterios de aceptación:

- Los bloques se pueden reordenar mediante arrastre.
- También se pueden mover hacia arriba y abajo con controles de teclado.
- Funcionan duplicar y eliminar.
- Los controles tienen nombres accesibles.
- El foco y el estado de selección son visibles.

### Issue 14. Implementar preview responsive e historial

- Tipo: `feature`, `P1`
- Objetivo: revisar la página en tamaños comunes y recuperar cambios recientes.
- Dependencias: Issues 11 y 13.

Criterios de aceptación:

- Se puede cambiar entre vista de escritorio y móvil.
- El panel lateral se puede ocultar.
- Funcionan deshacer y rehacer cambios recientes.
- Las preferencias de preview no modifican el documento persistente.

### Issue 15. Implementar autosave y control de conflictos

- Tipo: `feature`, `P0`
- Objetivo: guardar el borrador sin quitarle al usuario el control sobre sus cambios.
- Dependencias: Issues 4, 5 y 12.

Criterios de aceptación:

- El editor muestra los estados guardando, guardado y error.
- El borrador se guarda después de una pausa breve.
- Una versión antigua no puede sobrescribir una más reciente.
- Los cambios temporales siguen visibles si el guardado falla.

## Hito 3: imágenes y mensajes

### Issue 16. Implementar subida y reutilización de imágenes

- Tipo: `feature`, `P0`
- Objetivo: subir imágenes desde el editor y reutilizarlas en varios bloques.
- Dependencias: Issues 5, 7 y 12.

Criterios de aceptación:

- El servidor valida sesión, proyecto, tipo y tamaño.
- Los bytes se guardan en R2.
- D1 guarda metadata y asociación con el proyecto.
- El editor recibe un identificador de asset.
- La clave de R2 no depende únicamente del nombre original.

### Issue 17. Definir límites y validaciones de assets

- Tipo: `security`, `P0`
- Objetivo: establecer reglas seguras para archivos e imágenes.
- Dependencias: Issue 16.

Criterios de aceptación:

- Se documentan formatos permitidos y tamaño máximo.
- Se validan dimensiones y cuotas.
- Las imágenes de contenido requieren texto alternativo.
- Se define qué ocurre al eliminar un asset usado por un bloque.
- SVG solo se permite si existe una sanitización segura.

### Issue 18. Implementar formulario público de contacto

- Tipo: `feature`, `P0`
- Objetivo: recibir mensajes desde la página publicada.
- Dependencias: Issues 7 y 20.

Criterios de aceptación:

- El formulario resuelve el proyecto por slug y versión publicada.
- Valida nombre, email y mensaje.
- Incluye honeypot y límite de envíos.
- Guarda los mensajes en `form_submissions`.
- No expone datos privados del propietario.

### Issue 19. Crear bandeja privada de mensajes

- Tipo: `feature`, `P0`
- Objetivo: permitir al propietario consultar y organizar los mensajes recibidos.
- Dependencias: Issues 7 y 18.

Criterios de aceptación:

- El propietario puede listar y abrir mensajes.
- Puede marcar mensajes como leídos.
- Puede archivarlos o eliminarlos.
- Un usuario no puede ver mensajes de otro proyecto.

## Hito 4: publicación

### Issue 20. Normalizar slugs y resolver rutas públicas

- Tipo: `feature`, `P0`
- Objetivo: resolver sitios publicados mediante subrutas administradas.
- Dependencias: Issues 5 y 8.

Criterios de aceptación:

- Los slugs usan minúsculas, números y guiones.
- Se rechazan rutas reservadas.
- No existen colisiones.
- `/s/:slug` resuelve el proyecto correcto.
- Un slug inexistente muestra un error apropiado.

### Issue 21. Publicar snapshots inmutables

- Tipo: `feature`, `P0`
- Objetivo: separar con claridad el borrador de la versión pública.
- Dependencias: Issues 4, 5, 7 y 20.

Criterios de aceptación:

- Publicar valida el borrador completo.
- Se crea una nueva fila en `site_versions`.
- El proyecto apunta a `published_version_id`.
- Las versiones publicadas no se modifican.
- Los cambios posteriores permanecen en el borrador.

### Issue 22. Renderizar el sitio público con React

- Tipo: `feature`, `P0`
- Objetivo: mostrar la versión publicada en la URL administrada.
- Dependencias: Issues 9, 10, 20 y 21.

Criterios de aceptación:

- La página pública usa únicamente el snapshot publicado.
- Un borrador nunca aparece públicamente.
- La página funciona en móvil y escritorio.
- La composición usa los mismos bloques que el editor.

### Issue 23. Agregar SEO básico e invalidación de caché

- Tipo: `feature`, `P0`
- Objetivo: mantener actualizada la página pública y permitir compartirla correctamente.
- Dependencias: Issues 21 y 22.

Criterios de aceptación:

- El proyecto permite título, descripción y URL canónica.
- El HTML inicial contiene metadata básica.
- Publicar invalida o versiona la respuesta pública.
- No se sirve un snapshot antiguo después de confirmar la publicación, salvo una ventana documentada.

## Trabajo posterior al MVP: exportación Astro

La exportación Astro queda fuera del MVP. Estos issues se conservan como trabajo posterior y no bloquean la primera versión publicada.

### Issue 24. Crear plantilla Astro de exportación

- Tipo: `feature`, `post-MVP`
- Objetivo: generar un proyecto Astro portable a partir de un snapshot publicado.
- Dependencias: Issues 9, 10 y 21.

Criterios de aceptación:

- Existe una plantilla con layout, página, datos JSON y componentes de bloques.
- Los componentes Astro usan el contrato común de bloques.
- Los tipos desconocidos se rechazan.
- El contenido del usuario no genera archivos ejecutables.

### Issue 25. Exportar un snapshot publicado como ZIP

- Tipo: `feature`, `post-MVP`
- Objetivo: empaquetar el sitio como un proyecto Astro independiente.
- Dependencias: Issues 16, 21 y 24.

Criterios de aceptación:

- Se exporta únicamente una versión publicada.
- Se generan `site.json`, metadata SEO y assets.
- Los assets reciben nombres estables.
- Se incluye un `README.md` con instrucciones.
- El ZIP no contiene secretos ni credenciales privadas.

### Issue 26. Guardar y descargar exportaciones desde R2

- Tipo: `feature`, `post-MVP`
- Objetivo: guardar temporalmente los ZIP generados y permitir su descarga.
- Dependencias: Issues 5, 7 y 25.

Criterios de aceptación:

- El mismo snapshot y los mismos assets producen el mismo contenido lógico.
- El ZIP se guarda en R2.
- La descarga usa una URL temporal o un mecanismo equivalente.
- Se manejan errores y exportaciones grandes sin perder el proyecto original.

## Calidad y cierre del MVP

### Issue 27. Cubrir validaciones y reglas de seguridad

- Tipo: `test`, `security`, `P0`
- Objetivo: probar las reglas que protegen documentos, recursos y archivos.
- Dependencias: Issues 4, 7, 17, 18 y 20.

Criterios de aceptación:

- Se prueban documentos inválidos y propiedades desconocidas.
- Se prueban slugs reservados o duplicados.
- Se rechazan protocolos inseguros.
- Se rechazan archivos no permitidos y tamaños excesivos.
- Se verifica el rechazo de accesos a recursos ajenos.
- Se prueban sesiones ausentes, inválidas y expiradas.

### Issue 28. Cubrir el flujo E2E principal

- Tipo: `test`, `P0`
- Objetivo: verificar el recorrido completo del usuario.
- Dependencias: Issues 2, 8, 15, 16, 19, 21 y 22.

El escenario debe recorrer:

1. Registro.
2. Creación de proyecto.
3. Edición de bloques.
4. Subida de una imagen.
5. Autosave.
6. Publicación.
7. Envío del formulario.
8. Lectura del mensaje.

Criterios de aceptación:

- El flujo termina sin intervención manual.
- Se verifica el estado de cada paso.
- Se prueba al menos un caso de error relevante.

### Issue 29. Validar build y despliegue de Sites/Cloudflare

- Tipo: `test`, `P0`
- Objetivo: confirmar que el producto funciona en el entorno real de ejecución.
- Dependencias: Issues 5, 6, 21 y 22.

Criterios de aceptación:

- El build React termina correctamente.
- Las migraciones D1 funcionan.
- Las subidas R2 funcionan.
- La ruta pública funciona en el despliegue.

### Issue 30. Validar aceptación completa del MVP

- Tipo: `epic`, `P0`
- Objetivo: comprobar que el producto cumple el flujo principal definido.
- Dependencias: Issues 27, 28 y 29.

Criterios de aceptación:

- Una persona sin conocimientos técnicos puede crear y publicar un portafolio.
- Puede cambiar el orden de sus secciones.
- Puede reemplazar una imagen.
- Puede encontrar un mensaje enviado desde la página pública.
- No se conocen bloqueos P0 abiertos.

## Otras funcionalidades posteriores al MVP

Estas funcionalidades deben mantenerse fuera del primer alcance:

- Dominios personalizados y subdominios.
- Plantillas de restaurante y landing comercial.
- Colaboración entre usuarios.
- Analítica avanzada.
- Pagos y reservas.
- Formularios conectados desde un ZIP Astro.
- Astro SSR o builds estáticos por proyecto.

## Definición general de terminado

Un issue se considera terminado cuando:

- La funcionalidad cumple sus criterios de aceptación.
- Tiene pruebas proporcionales al riesgo.
- Respeta la autorización y validación del servidor.
- No introduce secretos en el navegador o en exportaciones.
- El lint y el build pasan.
- La documentación relevante queda actualizada.
