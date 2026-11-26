# Media y formularios

## Imágenes

El usuario podrá subir imágenes desde el editor y reutilizarlas en varios bloques del mismo proyecto.

Flujo recomendado:

1. El navegador solicita una subida autorizada.
2. El servidor valida sesión, proyecto, tipo y tamaño.
3. El archivo se guarda en R2 con una clave generada.
4. D1 registra metadata y la relación con el proyecto; la autorización se deriva de la membresía y los permisos.
5. El editor recibe un identificador de asset y lo guarda en el documento.

El navegador nunca debe poder elegir arbitrariamente la clave final de R2.

### Acceso a assets

El editor puede leer y administrar assets privados del proyecto solo con una membresía activa y el permiso requerido. Al publicar, el servidor valida el documento y extrae los IDs desde selectores declarados por cada tipo de bloque; guarda esa lista junto al snapshot inmutable. La URL pública solo sirve assets de esa lista en la versión señalada actualmente por `projects.published_version_id`. Los assets que solo aparecen en el borrador, los IDs escritos como texto común o los que dejaron la publicación activa no se sirven públicamente. La ruta debe comprobar esa relación en el servidor; no basta con conocer el ID del asset o su clave R2.

## Validaciones

La política de archivos es:

- Se aceptan JPEG, PNG y WebP. El servidor comprueba la firma y las dimensiones reales del contenido; no confía en la extensión ni en el MIME declarado por el navegador.
- Cada archivo puede ocupar hasta 10 MiB y medir hasta 8192 × 8192 píxeles, con un límite adicional de 40 megapíxeles. El mínimo es 1 × 1 píxel.
- Cada proyecto puede almacenar hasta 50 imágenes y 100 MiB. Cada cuenta puede subir hasta 250 imágenes y 500 MiB sumando sus proyectos. Los assets anteriores a la cuota se atribuyen al propietario del proyecto; los nuevos se atribuyen a quien los sube.
- Las imágenes de contenido necesitan texto alternativo no vacío, validado al editar y guardar el borrador. Al abrir borradores antiguos sin texto alternativo, el editor propone el nombre del archivo para que el usuario pueda revisarlo.
- SVG no está permitido. Se habilitará solo cuando exista una sanitización segura; `nosniff` y servirlo como imagen no sustituyen esa sanitización.
- Si se elimina una imagen usada en el borrador, el servidor elimina sus referencias de los bloques y aumenta la revisión del borrador. Si la publicación activa todavía la usa, la eliminación se rechaza con `409` hasta publicar una versión sin esa referencia. La eliminación de metadata y referencias del borrador es atómica; R2 se limpia después.

La primera versión puede evitar transformaciones complejas y usar URLs directas. La optimización de imágenes se puede añadir después de medir el tamaño real de los assets.

### Base técnica actual (Issue 16)

La aplicación expone `GET/POST /api/projects/{projectId}/assets` para listar y subir assets privados y `GET /api/assets/{assetId}` para entregar una imagen publicada o privada autorizada. Los nombres finales de R2 se generan con el ID de proyecto y el ID aleatorio del asset; el nombre original solo se conserva como metadata.

La política anterior se aplica en servidor antes de guardar el objeto en R2. El cuerpo multipart completo se limita a 10 MiB más 64 KiB de sobrecarga, y la inserción condicional en D1 vuelve a comprobar las cuotas para que subidas simultáneas no las excedan. La columna `uploaded_by_user_id` identifica al usuario que consume la cuota de cuenta; los registros previos usan el propietario del proyecto como atribución de compatibilidad.

## Formulario público

El bloque `contact` muestra un formulario cuando su prop `formEnabled` está activa. La plantilla de portafolio la activa por defecto; los bloques creados antes de esta prop la reciben desactivada. El texto del botón (`formSubmitLabel`) y el mensaje de confirmación (`formSuccessMessage`) se editan desde el panel de propiedades. El documento nunca guarda la URL de envío: el renderizador público pasa `contactFormEndpoint` en el contexto del bloque y, sin ese valor (por ejemplo en el editor), el formulario se muestra deshabilitado como vista previa.

El formulario envía JSON a `POST /api/sites/{slug}/messages`. La lógica vive en `resources/messages/`: `domain/forms.ts` define la parte común a todos los tipos de formulario y `domain/contact.ts` los campos de `contact`, que se validan con el mismo schema en el navegador y en el servidor. El cuerpo de la petición es:

```json
{
  "formId": "<id del bloque>",
  "formType": "contact",
  "fields": { "name": "…", "email": "…", "message": "…" },
  "website": ""
}
```

Para agregar otro tipo de formulario, registra en `FORM_DEFINITIONS` el bloque que lo muestra, la versión de su payload y el schema de sus campos.

- **Resolución:** el servidor busca el proyecto por slug, exige que no esté archivado y lee solo el snapshot de `published_version_id`. El snapshot debe tener un bloque visible con id `formId`, del tipo que corresponde a `formType` y con `formEnabled === true`. El borrador nunca habilita el formulario.
- **Campos:** el sobre (`formId` de hasta 128 caracteres, `formType` conocido) se valida primero, sin detalle por campo. Después, los campos de `contact`: `name` (1–100 caracteres), `email` (email válido, hasta 254) y `message` (1–5000). Se normalizan a NFKC y se recortan. Se rechazan caracteres de control, salvo saltos de línea y tabuladores en el mensaje, así como cualquier clave desconocida. Ambas validaciones ocurren antes de consultar D1.
- **Honeypot:** el campo oculto `website` queda fuera del orden de tabulación y del árbol de accesibilidad. Si llega con contenido, la respuesta es la misma que la de un envío válido (`201`), pero el mensaje no se guarda. El intento sí consume el límite de envíos.
- **Límite de envíos:** ventanas fijas de 3 envíos cada 10 minutos y 10 cada 24 horas por IP y proyecto, más 60 por hora por proyecto. Los límites se comparten entre todos los formularios del proyecto. La IP proviene de `CF-Connecting-IP` y se guarda solo como HMAC con `FORM_RATE_LIMIT_SECRET`. Sin ese secreto, solo se aplica el límite por proyecto. Los contadores y la inserción se ejecutan en un único batch de D1, de modo que los envíos simultáneos no superan el límite. Al excederlo, la ruta responde `429` con `Retry-After`.
- **Guardado:** los campos validados se guardan como objeto JSON en `form_submissions.payload_json`, junto con `form_type`, `payload_version`, `form_id` y `site_version_id`, y con `status = 'unread'`. No se guardan IP ni user agent. [Datos y persistencia](03-datos-y-persistencia.md) describe cómo interpretar cada fila.
- **Privacidad:** la ruta exige `Origin` igual al de la aplicación (`403` si no) y solo acepta `application/json` (`415`) de hasta 16 KiB (`413`). Responde con el mismo `404` si el slug no existe, no está publicado, está archivado o no ofrece el formulario. Ninguna respuesta incluye IDs del proyecto ni datos de sus miembros, y la ruta no registra el contenido de la petición.
- **Respuestas:** `201 {"ok":true}`; `400` con `fields` por campo; `503` genérico ante fallos de D1. Todas usan `Cache-Control: no-store`.

El envío requiere JavaScript, porque la página pública hidrata React. El envío sin JavaScript (formulario `x-www-form-urlencoded` con redirección) y un captcha como Turnstile quedan como mejoras posteriores, si el honeypot y el límite no bastan.

La bandeja privada (Issue 19) permitirá listar mensajes, abrir el detalle, marcar como leído y eliminar o archivar.

## Exportación Astro

La URL administrada puede conectar el formulario con la bandeja interna. Un export Astro descargado en otro hosting no tendrá automáticamente esa capacidad porque no debe incluir credenciales privadas.

En una fase posterior al MVP, el export incluirá enlaces de email, teléfono y redes. Si se necesita un formulario conectado, el proyecto exportado tendrá que recibir una URL pública y una configuración explícita del endpoint.
