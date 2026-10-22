import { and, eq, sql } from 'drizzle-orm';
import { createDb } from '../../../database/d1/client';
import {
  projectMembers,
  projectRolePermissions,
  projectRoles,
  projects,
  users,
  type ProjectPermissionCode,
} from '../../../database/d1/schema';
import type { AuthUser } from '../../auth';
import {
  canAccessProjectPermission,
  ProjectAccessError,
  projectAccessDenied,
  projectAccessUnavailable,
} from '../domain/access';

export { isMemberGrantablePermission, ProjectAccessError } from '../domain/access';

/**
 * Add this condition to the protected resource query itself, especially for
 * writes. That keeps the membership and permission check atomic with the
 * operation that reads or changes the row.
 */
export function projectPermissionPredicate(
  authSubject: string,
  projectId: string,
  permission: ProjectPermissionCode,
) {
  return sql`EXISTS (
    SELECT 1
    FROM project_members AS m
    INNER JOIN users AS u ON u.id = m.user_id
    INNER JOIN project_roles AS r
      ON r.id = m.role_id AND r.project_id = m.project_id
    WHERE m.project_id = ${projectId}
      AND u.auth_subject = ${authSubject}
      AND m.status = 'active'
      AND (
        r.kind = 'system_owner'
        OR EXISTS (
          SELECT 1
          FROM project_role_permissions AS rp
          WHERE rp.project_id = m.project_id
            AND rp.role_id = r.id
            AND rp.permission_code = ${permission}
        )
      )
  )`;
}

export async function requireProjectPermission(
  database: D1Database,
  authUser: AuthUser,
  projectId: string,
  permission: ProjectPermissionCode,
) {
  if (typeof projectId !== 'string' || !projectId.trim()) throw projectAccessDenied();

  try {
    const db = createDb(database);
    const [localUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authSubject, authUser.id))
      .limit(1);

    if (!localUser) throw projectAccessDenied();

    const [membership] = await db
      .select({
        userId: projectMembers.userId,
        roleId: projectRoles.id,
        roleKind: projectRoles.kind,
        status: projectMembers.status,
        permissionCode: projectRolePermissions.permissionCode,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .innerJoin(projectRoles, and(
        eq(projectRoles.id, projectMembers.roleId),
        eq(projectRoles.projectId, projectMembers.projectId),
      ))
      .leftJoin(projectRolePermissions, and(
        eq(projectRolePermissions.projectId, projectMembers.projectId),
        eq(projectRolePermissions.roleId, projectRoles.id),
        eq(projectRolePermissions.permissionCode, permission),
      ))
      .where(and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, localUser.id),
        eq(projectMembers.status, 'active'),
      ))
      .limit(1);

    const allowed = canAccessProjectPermission(membership ? {
      active: membership.status === 'active',
      roleKind: membership.roleKind,
      permissions: membership.permissionCode === permission ? [permission] : [],
    } : null, permission);

    if (!membership || !allowed) throw projectAccessDenied();

    return {
      userId: localUser.id,
      projectId,
      roleId: membership.roleId,
      roleKind: membership.roleKind,
    };
  } catch (error) {
    if (error instanceof ProjectAccessError) throw error;
    throw projectAccessUnavailable();
  }
}
