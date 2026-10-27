import type { AuthUser } from '../../auth';
import type { AuthBindings } from '../../auth/server';
import { withAuthUser } from '../../auth/server';
import { ProjectAccessError } from '../domain/access';
import {
  parseCreateProjectInput,
  parseUpdateProjectInput,
  ProjectInputError,
} from '../domain/project';
import { ProjectCreationError, ProjectSlugConflictError, createProjectWithOwner } from './create-project';
import {
  deleteProject,
  getProjectDraft,
  listProjects,
  ProjectManagementError,
  updateProject,
} from './manage-projects';

type ProjectBindings = AuthBindings & { DB?: D1Database };

function projectJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      Pragma: 'no-cache',
      Vary: 'Cookie',
    },
  });
}

function sameOriginMutation(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function projectErrorResponse(error: unknown) {
  if (error instanceof ProjectInputError) {
    return projectJson({ error: error.code, message: error.message }, error.status);
  }
  if (error instanceof ProjectSlugConflictError) {
    return projectJson({ error: error.code, message: error.message }, error.status);
  }
  if (error instanceof ProjectCreationError || error instanceof ProjectManagementError) {
    return projectJson({ error: error.code, message: error.message }, error.status);
  }
  if (error instanceof ProjectAccessError) {
    return projectJson({ error: error.code, message: error.message }, error.status);
  }
  return projectJson({
    error: 'project_management_unavailable',
    message: 'No se pudo completar la operación del proyecto. Inténtalo de nuevo.',
  }, 503);
}

async function readJsonBody(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new ProjectInputError('Envía los datos del proyecto como JSON.');
  }

  const text = await request.text();
  if (text.length > 4096) throw new ProjectInputError('Los datos del proyecto son demasiado largos.');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProjectInputError('El cuerpo de la solicitud no contiene JSON válido.');
  }
}

function requireDatabase(bindings: ProjectBindings): D1Database {
  if (!bindings.DB) throw new ProjectManagementError();
  return bindings.DB;
}

export async function handleListProjects(request: Request, bindings: ProjectBindings) {
  return withAuthUser(request, bindings, async (user: AuthUser) => {
    try {
      const projects = await listProjects(requireDatabase(bindings), user);
      return projectJson({ projects });
    } catch (error) {
      return projectErrorResponse(error);
    }
  });
}

export async function handleGetProject(
  request: Request,
  bindings: ProjectBindings,
  projectId: string,
) {
  return withAuthUser(request, bindings, async (user: AuthUser) => {
    try {
      const result = await getProjectDraft(requireDatabase(bindings), user, projectId);
      return projectJson(result);
    } catch (error) {
      return projectErrorResponse(error);
    }
  });
}

export async function handleCreateProject(request: Request, bindings: ProjectBindings) {
  if (!sameOriginMutation(request)) {
    return projectJson({ error: 'origin_rejected', message: 'La solicitud no tiene un origen válido.' }, 403);
  }

  return withAuthUser(request, bindings, async (user: AuthUser) => {
    try {
      const project = parseCreateProjectInput(await readJsonBody(request));
      const created = await createProjectWithOwner(requireDatabase(bindings), user, project);
      return projectJson({
        projectId: created.projectId,
        slug: project.slug,
      }, 201);
    } catch (error) {
      return projectErrorResponse(error);
    }
  });
}

export async function handleUpdateProject(
  request: Request,
  bindings: ProjectBindings,
  projectId: string,
) {
  if (!sameOriginMutation(request)) {
    return projectJson({ error: 'origin_rejected', message: 'La solicitud no tiene un origen válido.' }, 403);
  }

  return withAuthUser(request, bindings, async (user: AuthUser) => {
    try {
      const details = parseUpdateProjectInput(await readJsonBody(request));
      const project = await updateProject(requireDatabase(bindings), user, projectId, details);
      return projectJson({ project });
    } catch (error) {
      return projectErrorResponse(error);
    }
  });
}

export async function handleDeleteProject(
  request: Request,
  bindings: ProjectBindings,
  projectId: string,
) {
  if (!sameOriginMutation(request)) {
    return projectJson({ error: 'origin_rejected', message: 'La solicitud no tiene un origen válido.' }, 403);
  }

  return withAuthUser(request, bindings, async (user: AuthUser) => {
    try {
      const result = await deleteProject(requireDatabase(bindings), user, projectId);
      return projectJson(result);
    } catch (error) {
      return projectErrorResponse(error);
    }
  });
}

