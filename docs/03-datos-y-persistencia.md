# Modelo de datos y persistencia

## Fuente de verdad

El contenido de un sitio debe existir como un documento versionado y validado. No conviene almacenar una copia distinta para el editor React, la publicación React y la exportación Astro.

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

Cada cambio debe pasar por una validación de esquema. Una migración futura podrá convertir documentos antiguos a una versión nueva antes de editarlos o publicarlos.

## D1

Tablas iniciales sugeridas:

### users

- id
- auth_subject
- email
- created_at
- updated_at

auth_subject debe ser único. La aplicación no guarda contraseñas.

### projects

- id
- owner_id
- name
- slug
- status
- draft_document_json
- published_version_id
- created_at
- updated_at

El slug debe ser único dentro de la modalidad de URL administrada.

### site_versions

- id
- project_id
- document_json
- document_version
- created_at
- published_at

Las versiones publicadas no se modifican. Si el usuario vuelve a publicar, se crea otra versión.

### assets

- id
- project_id
- r2_key
- filename
- content_type
- byte_size
- alt_text
- created_at

### form_submissions

- id
- project_id
- name
- email
- message
- status
- created_at

## R2

R2 almacenará los bytes de imágenes y exportaciones. D1 solo conservará metadata, relaciones de propiedad y claves de objetos.

Las claves de objetos no deben depender únicamente del nombre original. Deben incluir el usuario, el proyecto y un identificador generado por la aplicación.

## Índices

Crear índices para las consultas reales del MVP:

- Proyectos por owner_id.
- Proyecto por slug.
- Versiones por project_id y fecha.
- Assets por project_id.
- Mensajes por project_id, estado y fecha.

## Futuro de dominios

Aunque los dominios quedan fuera del MVP, el modelo puede reservar una tabla futura domain_mappings con:

- id
- project_id
- hostname
- path_prefix
- kind
- verification_status
- is_primary

La combinación de hostname y prefijo debe ser única. Esto permite representar un dominio propio por proyecto, un subdominio o varios proyectos bajo distintas subrutas de un mismo dominio.
