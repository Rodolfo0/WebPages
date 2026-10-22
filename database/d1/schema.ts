import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const PROJECT_STATUSES = ['draft', 'published', 'archived'] as const;
export const FORM_SUBMISSION_STATUSES = ['unread', 'read', 'archived'] as const;
export const PROJECT_ROLE_KINDS = ['system_owner', 'custom'] as const;
export const PROJECT_MEMBER_STATUSES = ['active', 'inactive'] as const;

export const PROJECT_PERMISSION_DEFINITIONS = [
  { code: 'project:read', description: 'Consultar el proyecto', memberGrantable: true },
  { code: 'project:update', description: 'Modificar la configuración del proyecto', memberGrantable: true },
  { code: 'project:delete', description: 'Eliminar el proyecto', memberGrantable: false },
  { code: 'sharing:manage', description: 'Administrar el acceso compartido', memberGrantable: false },
  { code: 'owners:manage', description: 'Agregar o quitar owners', memberGrantable: false },
  { code: 'assets:read', description: 'Consultar assets privados', memberGrantable: true },
  { code: 'assets:manage', description: 'Subir o eliminar assets', memberGrantable: true },
  { code: 'messages:read', description: 'Consultar mensajes', memberGrantable: true },
  { code: 'messages:manage', description: 'Organizar o eliminar mensajes', memberGrantable: true },
  { code: 'publication:publish', description: 'Publicar una versión', memberGrantable: true },
  { code: 'export:create', description: 'Generar o descargar una exportación', memberGrantable: true },
] as const;

export type ProjectPermissionCode = typeof PROJECT_PERMISSION_DEFINITIONS[number]['code'];

const idColumn = (name: string) =>
  text(name)
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAtColumn = (name = 'created_at') =>
  integer(name, { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const users = sqliteTable(
  'users',
  {
    id: idColumn('id'),
    authSubject: text('auth_subject').notNull(),
    email: text('email').notNull(),
    createdAt: createdAtColumn(),
    updatedAt: createdAtColumn('updated_at'),
  },
  (table) => [
    uniqueIndex('users_auth_subject_uidx').on(table.authSubject),
    index('users_email_idx').on(table.email),
  ],
);

export const projects = sqliteTable(
  'projects',
  {
    id: idColumn('id'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    status: text('status', { enum: PROJECT_STATUSES }).notNull().default('draft'),
    draftDocumentJson: text('draft_document_json').notNull(),
    publishedVersionId: text('published_version_id'),
    createdAt: createdAtColumn(),
    updatedAt: createdAtColumn('updated_at'),
  },
  (table) => [
    check('projects_name_nonempty', sql`length(trim(${table.name})) > 0`),
    check('projects_slug_nonempty', sql`length(trim(${table.slug})) > 0`),
    check(
      'projects_status_valid',
      sql`${table.status} in ('draft', 'published', 'archived')`,
    ),
    check('projects_draft_document_json_valid', sql`json_valid(${table.draftDocumentJson})`),
    index('projects_created_by_idx').on(table.createdBy),
    uniqueIndex('projects_slug_uidx').on(table.slug),
    index('projects_status_created_at_idx').on(table.status, table.createdAt),
    index('projects_created_at_idx').on(table.createdAt),
  ],
);

export const projectPermissions = sqliteTable(
  'project_permissions',
  {
    code: text('code').primaryKey(),
    description: text('description').notNull(),
    memberGrantable: integer('member_grantable', { mode: 'boolean' }).notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    check(
      'project_permissions_member_grantable_valid',
      sql`${table.memberGrantable} in (0, 1)`,
    ),
  ],
);

export const projectRoles = sqliteTable(
  'project_roles',
  {
    id: idColumn('id'),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: text('kind', { enum: PROJECT_ROLE_KINDS }).notNull(),
    createdAt: createdAtColumn(),
    updatedAt: createdAtColumn('updated_at'),
  },
  (table) => [
    check('project_roles_name_nonempty', sql`length(trim(${table.name})) > 0`),
    check('project_roles_kind_valid', sql`${table.kind} in ('system_owner', 'custom')`),
    uniqueIndex('project_roles_project_id_id_uidx').on(table.projectId, table.id),
    uniqueIndex('project_roles_project_name_uidx').on(table.projectId, table.name),
    uniqueIndex('project_roles_one_system_owner_uidx')
      .on(table.projectId)
      .where(sql`${table.kind} = 'system_owner'`),
    index('project_roles_project_created_at_idx').on(table.projectId, table.createdAt),
  ],
);

export const projectRolePermissions = sqliteTable(
  'project_role_permissions',
  {
    projectId: text('project_id').notNull(),
    roleId: text('role_id').notNull(),
    permissionCode: text('permission_code').notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    primaryKey({
      name: 'project_role_permissions_pk',
      columns: [table.projectId, table.roleId, table.permissionCode],
    }),
    foreignKey({
      name: 'project_role_permissions_project_role_fk',
      columns: [table.projectId, table.roleId],
      foreignColumns: [projectRoles.projectId, projectRoles.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'project_role_permissions_permission_fk',
      columns: [table.permissionCode],
      foreignColumns: [projectPermissions.code],
    }).onDelete('restrict'),
    index('project_role_permissions_role_idx').on(table.projectId, table.roleId),
  ],
);

export const projectMembers = sqliteTable(
  'project_members',
  {
    projectId: text('project_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    roleId: text('role_id').notNull(),
    status: text('status', { enum: PROJECT_MEMBER_STATUSES }).notNull().default('active'),
    createdAt: createdAtColumn(),
    updatedAt: createdAtColumn('updated_at'),
  },
  (table) => [
    primaryKey({
      name: 'project_members_pk',
      columns: [table.projectId, table.userId],
    }),
    check('project_members_status_valid', sql`${table.status} in ('active', 'inactive')`),
    foreignKey({
      name: 'project_members_project_fk',
      columns: [table.projectId],
      foreignColumns: [projects.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'project_members_project_role_fk',
      columns: [table.projectId, table.roleId],
      foreignColumns: [projectRoles.projectId, projectRoles.id],
    }).onDelete('no action'),
    index('project_members_user_status_project_idx').on(table.userId, table.status, table.projectId),
    index('project_members_project_status_role_idx').on(table.projectId, table.status, table.roleId),
  ],
);

export const siteVersions = sqliteTable(
  'site_versions',
  {
    id: idColumn('id'),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    documentJson: text('document_json').notNull(),
    referencedAssetIdsJson: text('referenced_asset_ids_json').notNull().default('[]'),
    documentVersion: integer('document_version').notNull(),
    createdAt: createdAtColumn(),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    check('site_versions_document_json_valid', sql`json_valid(${table.documentJson})`),
    check(
      'site_versions_referenced_asset_ids_json_array',
      sql`json_valid(${table.referencedAssetIdsJson}) and json_type(${table.referencedAssetIdsJson}) = 'array'`,
    ),
    check('site_versions_document_version_positive', sql`${table.documentVersion} > 0`),
    index('site_versions_project_created_at_idx').on(table.projectId, table.createdAt),
  ],
);

export const assets = sqliteTable(
  'assets',
  {
    id: idColumn('id'),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    r2Key: text('r2_key').notNull(),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    altText: text('alt_text'),
    createdAt: createdAtColumn(),
  },
  (table) => [
    check('assets_byte_size_positive', sql`${table.byteSize} > 0`),
    uniqueIndex('assets_r2_key_uidx').on(table.r2Key),
    index('assets_project_created_at_idx').on(table.projectId, table.createdAt),
  ],
);

export const formSubmissions = sqliteTable(
  'form_submissions',
  {
    id: idColumn('id'),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    message: text('message').notNull(),
    status: text('status', { enum: FORM_SUBMISSION_STATUSES }).notNull().default('unread'),
    createdAt: createdAtColumn(),
  },
  (table) => [
    check('form_submissions_name_nonempty', sql`length(trim(${table.name})) > 0`),
    check('form_submissions_email_nonempty', sql`length(trim(${table.email})) > 0`),
    check('form_submissions_message_nonempty', sql`length(trim(${table.message})) > 0`),
    check(
      'form_submissions_status_valid',
      sql`${table.status} in ('unread', 'read', 'archived')`,
    ),
    index('form_submissions_project_status_created_at_idx').on(
      table.projectId,
      table.status,
      table.createdAt,
    ),
  ],
);
