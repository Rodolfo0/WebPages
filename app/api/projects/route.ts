import { env } from 'cloudflare:workers';
import { handleCreateProject, handleListProjects } from '@/resources/projects/server';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return handleListProjects(request, env);
}

export function POST(request: Request) {
  return handleCreateProject(request, env);
}
