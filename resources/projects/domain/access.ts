import {
  PROJECT_PERMISSION_DEFINITIONS,
  type ProjectPermissionCode,
} from '../../../database/d1/schema';

export type ProjectAccessRecord = {
  active: boolean;
  roleKind: 'system_owner' | 'custom';
  permissions: readonly ProjectPermissionCode[];
};

export function canAccessProjectPermission(
  access: ProjectAccessRecord | null,
  permission: ProjectPermissionCode,
) {
  if (!access?.active) return false;
  return access.roleKind === 'system_owner' || access.permissions.includes(permission);
}

export function isMemberGrantablePermission(permission: ProjectPermissionCode) {
  return PROJECT_PERMISSION_DEFINITIONS.find((entry) => entry.code === permission)
    ?.memberGrantable === true;
}

export class ProjectAccessError extends Error {
  constructor(
    public readonly code: 'project_access_denied' | 'project_access_unavailable',
    public readonly status: 404 | 503,
    message: string,
  ) {
    super(message);
    this.name = 'ProjectAccessError';
  }
}

export function projectAccessDenied() {
  return new ProjectAccessError(
    'project_access_denied',
    404,
    'El recurso solicitado no está disponible.',
  );
}

export function projectAccessUnavailable() {
  return new ProjectAccessError(
    'project_access_unavailable',
    503,
    'No se pudo comprobar el acceso al proyecto. Inténtalo de nuevo.',
  );
}
