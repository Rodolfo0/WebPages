import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const PROJECT_STATUSES = ['draft', 'published', 'archived'] as const;
export const FORM_SUBMISSION_STATUSES = ['unread', 'read', 'archived'] as const;

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
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
    index('projects_owner_id_idx').on(table.ownerId),
    uniqueIndex('projects_slug_uidx').on(table.slug),
    index('projects_status_created_at_idx').on(table.status, table.createdAt),
    index('projects_created_at_idx').on(table.createdAt),
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
    documentVersion: integer('document_version').notNull(),
    createdAt: createdAtColumn(),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    check('site_versions_document_json_valid', sql`json_valid(${table.documentJson})`),
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
