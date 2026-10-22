import { and, desc, eq, exists, or, sql } from 'drizzle-orm';
import { createDb } from '../../../database/d1/client';
import {
  projectMembers,
  projectRolePermissions,
  projectRoles,
  projects,
  users,
} from '../../../database/d1/schema';
import type { AuthUser } from '../../auth';
import { projectAccessDenied, ProjectAccessError } from '../domain/access';
import { ProjectSlugConflictError } from './create-project';
import { projectPermissionPredicate } from './access';

export class ProjectManagementError extends Error {
  readonly code = 'project_management_unavailable';
  readonly status = 503;

  constructor() {
    super('No se pudo completar la operación del proyecto. Inténtalo de nuevo.');
    this.name = 'ProjectManagementError';
  }
}

export async function listProjects(database: D1Database, authUser: AuthUser) {
  try {
    const db = createDb(database);
    const canRead = exists(
      db.select({ permissionCode: projectRolePermissions.permissionCode })
        .from(projectRolePermissions)
        .where(and(
          eq(projectRolePermissions.projectId, projectMembers.projectId),
          eq(projectRolePermissions.roleId, projectRoles.id),
          eq(projectRolePermissions.permissionCode, 'project:read'),
        )),
    );

    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        status: projects.status,
        hasDraft: sql<number>`CASE WHEN length(trim(${projects.draftDocumentJson})) > 0 THEN 1 ELSE 0 END`,
        hasPublished: sql<number>`CASE WHEN ${projects.publishedVersionId} IS NOT NULL THEN 1 ELSE 0 END`,
        canEdit: sql<number>`CASE
          WHEN ${projectRoles.kind} = 'system_owner'
            OR EXISTS (
              SELECT 1 FROM project_role_permissions AS edit_permission
              WHERE edit_permission.project_id = ${projects.id}
                AND edit_permission.role_id = ${projectRoles.id}
                AND edit_permission.permission_code = 'project:update'
            )
          THEN 1 ELSE 0 END`,
        canDelete: sql<number>`CASE
          WHEN ${projectRoles.kind} = 'system_owner'
            OR EXISTS (
              SELECT 1 FROM project_role_permissions AS delete_permission
              WHERE delete_permission.project_id = ${projects.id}
                AND delete_permission.role_id = ${projectRoles.id}
                AND delete_permission.permission_code = 'project:delete'
            )
          THEN 1 ELSE 0 END`,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .innerJoin(projectMembers, and(
        eq(projectMembers.projectId, projects.id),
        eq(projectMembers.status, 'active'),
      ))
      .innerJoin(users, and(
        eq(users.id, projectMembers.userId),
        eq(users.authSubject, authUser.id),
      ))
      .innerJoin(projectRoles, and(
        eq(projectRoles.id, projectMembers.roleId),
        eq(projectRoles.projectId, projectMembers.projectId),
      ))
      .where(or(eq(projectRoles.kind, 'system_owner'), canRead))
      .orderBy(desc(projects.updatedAt), projects.name);

    return rows.map((project) => ({
      ...project,
      hasDraft: project.hasDraft === 1,
      hasPublished: project.hasPublished === 1,
      canEdit: project.canEdit === 1,
      canDelete: project.canDelete === 1,
    }));
  } catch {
    throw new ProjectManagementError();
  }
}

export async function updateProject(
  database: D1Database,
  authUser: AuthUser,
  projectId: string,
  details: { name: string; slug: string },
) {
  if (typeof projectId !== 'string' || !projectId.trim()) throw projectAccessDenied();

  try {
    const db = createDb(database);
    const [updated] = await db
      .update(projects)
      .set({
        name: details.name,
        slug: details.slug,
        draftDocumentJson: sql<string>`json_set(${projects.draftDocumentJson}, '$.site.slug', ${details.slug})`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(projects.id, projectId),
        sql`NOT EXISTS (
          SELECT 1 FROM projects AS conflicting
          WHERE conflicting.slug = ${details.slug}
            AND conflicting.id <> ${projectId}
        )`,
        projectPermissionPredicate(authUser.id, projectId, 'project:update'),
      ))
      .returning({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        updatedAt: projects.updatedAt,
      });

    if (updated) return updated;

    const [accessibleProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        projectPermissionPredicate(authUser.id, projectId, 'project:update'),
      ))
      .limit(1);

    if (!accessibleProject) throw projectAccessDenied();
    throw new ProjectSlugConflictError();
  } catch (error) {
    if (error instanceof ProjectAccessError || error instanceof ProjectSlugConflictError) throw error;
    if (isProjectSlugConstraintError(error)) throw new ProjectSlugConflictError();
    throw new ProjectManagementError();
  }
}

export async function deleteProject(
  database: D1Database,
  authUser: AuthUser,
  projectId: string,
) {
  if (typeof projectId !== 'string' || !projectId.trim()) throw projectAccessDenied();

  try {
    const db = createDb(database);
    const [deleted] = await db
      .delete(projects)
      .where(and(
        eq(projects.id, projectId),
        projectPermissionPredicate(authUser.id, projectId, 'project:delete'),
      ))
      .returning({ id: projects.id });

    if (!deleted) throw projectAccessDenied();
    return { deleted: true } as const;
  } catch (error) {
    if (error instanceof ProjectAccessError) throw error;
    throw new ProjectManagementError();
  }
}

function isProjectSlugConstraintError(error: unknown) {
  return error instanceof Error
    && /projects_slug_uidx|projects\.slug/i.test(error.message);
}

