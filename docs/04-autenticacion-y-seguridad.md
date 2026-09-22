# Autenticación y seguridad

## Principio

No se debe construir un sistema de contraseñas propio. El registro, el almacenamiento seguro de credenciales, la recuperación de acceso, la verificación de email y la gestión de sesiones deben delegarse a una librería o servicio reconocido y mantenido.

La opción inicial del plan es Supabase Auth con su SDK oficial. Antes de implementarlo hay que confirmar su compatibilidad con el runtime de Sites. Si no encaja, se elegirá otra solución gestionada con soporte para email y contraseña. No se sustituirá por hashes y sesiones escritos manualmente.

## Adaptador

La aplicación debe ocultar el proveedor detrás de una interfaz pequeña:

    type AuthUser = {
      id: string
      email: string
    }

    interface AuthAdapter {
      getUser(request: Request): Promise<AuthUser | null>
      requireUser(request: Request): Promise<AuthUser>
      signOut(request: Request): Promise<Response>
    }

El resto de la aplicación recibe un usuario autenticado, no un objeto específico del proveedor.

## Flujos

- Registro con email y contraseña.
- Confirmación de email cuando el proveedor lo requiera.
- Inicio de sesión.
- Cierre de sesión.
- Recuperación y cambio de contraseña mediante el proveedor.
- Renovación y expiración de sesión.
- Mensaje claro para una sesión inválida o expirada.

## Autorización

La autenticación identifica al usuario. La autorización decide qué puede hacer con cada recurso.

Cada consulta privada debe comprobar el propietario en el servidor. No basta con ocultar botones en React. Las operaciones que requieren esta comprobación incluyen:

- Leer o modificar un proyecto.
- Subir, eliminar o usar un asset.
- Leer mensajes.
- Crear una versión publicada.
- Generar una exportación.

## Reglas de seguridad

- No almacenar contraseñas, hashes, tokens de sesión ni códigos de recuperación en D1.
- No incluir claves privadas en el navegador ni dentro de un ZIP exportado.
- Validar los cuerpos de las peticiones en el servidor.
- Escapar textos y URLs al renderizar bloques.
- Permitir solo protocolos seguros en enlaces externos.
- Comprobar tipo y tamaño antes de guardar archivos.
- Evitar que un usuario use un projectId ajeno aunque lo modifique manualmente en la petición.
- Registrar errores sin guardar contraseñas, tokens o contenido sensible innecesario.
- Mantener dependencias actualizadas y bloquear versiones en producción.

## Pruebas de seguridad

- Registro e inicio de sesión correctos.
- Sesión ausente, inválida y expirada.
- Acceso a un proyecto de otro usuario.
- Manipulación de IDs en rutas y cuerpos.
- Subida de archivos no permitidos.
- Enlaces con protocolos inseguros.
- Recuperación de contraseña sin revelar si un email existe.
