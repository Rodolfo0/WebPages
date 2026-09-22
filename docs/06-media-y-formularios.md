# Media y formularios

## Imágenes

El usuario podrá subir imágenes desde el editor y reutilizarlas en varios bloques del mismo proyecto.

Flujo recomendado:

1. El navegador solicita una subida autorizada.
2. El servidor valida sesión, proyecto, tipo y tamaño.
3. El archivo se guarda en R2 con una clave generada.
4. D1 registra metadata, propietario y proyecto.
5. El editor recibe un identificador de asset y lo guarda en el documento.

El navegador nunca debe poder elegir arbitrariamente la clave final de R2.

## Validaciones

Definir antes de implementar:

- Tipos permitidos, inicialmente JPEG, PNG, WebP y SVG solo si se sanitiza de forma segura.
- Tamaño máximo por archivo.
- Cuota por proyecto y por usuario.
- Dimensiones máximas y mínimas.
- Texto alternativo obligatorio para imágenes de contenido.
- Qué ocurre si se elimina un asset todavía usado por un bloque.

La primera versión puede evitar transformaciones complejas y usar URLs directas. La optimización de imágenes se puede añadir después de medir el tamaño real de los assets.

## Formulario público

El bloque de contacto debe enviar mensajes a una ruta pública asociada al proyecto publicado. La ruta debe:

- Resolver el proyecto por slug y versión publicada.
- Validar nombre, email y mensaje.
- Ignorar o marcar envíos con honeypot.
- Aplicar límite por IP o por ventana de tiempo.
- Guardar el mensaje en form_submissions.
- No revelar datos privados del propietario.

La bandeja privada permitirá listar mensajes, abrir el detalle, marcar como leído y eliminar o archivar.

## Exportación Astro

La URL administrada puede conectar el formulario con la bandeja interna. Un export Astro descargado en otro hosting no tendrá automáticamente esa capacidad porque no debe incluir credenciales privadas.

En el MVP, el export incluirá enlaces de email, teléfono y redes. Si se necesita un formulario conectado, el proyecto exportado tendrá que recibir una URL pública y una configuración explícita del endpoint.
