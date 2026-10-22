import { env } from 'cloudflare:workers';
import { handleDeleteProject, handleUpdateProject } from '@/resources/projects/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ projectId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  return handleUpdateProject(request, env, projectId);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  return handleDeleteProject(request, env, projectId);
}
