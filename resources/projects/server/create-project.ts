import type { AuthUser } from '../../auth';
import { projectAccessDenied, ProjectAccessError } from '../domain/access';

export class ProjectCreationError extends Error {
  readonly code = 'project_creation_unavailable';
  readonly status = 503;

  constructor() {
    super('No se pudo crear el proyecto. Inténtalo de nuevo.');
    this.name = 'ProjectCreationError';
  }
}

export class ProjectSlugConflictError extends Error {
  readonly code = 'project_slug_conflict';
  readonly status = 409;

  constructor() {
    super('Ya existe un proyecto con ese slug.');
    this.name = 'ProjectSlugConflictError';
  }
}

export type InitialProject = {
  name: string;
  slug: string;
  draftDocumentJson: string;
};

/** Creates the project, its owner role, and the creator's owner membership atomically. */
export async function createProjectWithOwner(
  database: D1Database,
  authUser: AuthUser,
  project: InitialProject,
) {
  try {
    const localUser = await database
      .prepare('SELECT id FROM users WHERE auth_subject = ? LIMIT 1')
      .bind(authUser.id)
      .first<{ id: string }>();

    if (!localUser) throw projectAccessDenied();

    const projectId = crypto.randomUUID();
    const ownerRoleId = crypto.randomUUID();
    const [createdProject] = await database.batch<{ id: string }>([
      database.prepare(`
        INSERT INTO projects (id, created_by, name, slug, status, draft_document_json)
        VALUES (?, ?, ?, ?, 'draft', ?)
        ON CONFLICT(slug) DO NOTHING
        RETURNING id
      `).bind(projectId, localUser.id, project.name, project.slug, project.draftDocumentJson),
      database.prepare(`
        INSERT INTO project_roles (id, project_id, name, kind)
        SELECT ?, ?, 'Owner', 'system_owner'
        WHERE EXISTS (SELECT 1 FROM projects WHERE id = ?)
      `).bind(ownerRoleId, projectId, projectId),
      database.prepare(`
        INSERT INTO project_members (project_id, user_id, role_id, status)
        SELECT ?, ?, ?, 'active'
        WHERE EXISTS (
          SELECT 1 FROM project_roles
          WHERE id = ? AND project_id = ? AND kind = 'system_owner'
        )
      `).bind(projectId, localUser.id, ownerRoleId, ownerRoleId, projectId),
    ]);

    if (!createdProject?.results[0]) throw new ProjectSlugConflictError();

    return { projectId, userId: localUser.id, ownerRoleId };
  } catch (error) {
    if (error instanceof ProjectAccessError || error instanceof ProjectSlugConflictError) throw error;
    throw new ProjectCreationError();
  }
}
