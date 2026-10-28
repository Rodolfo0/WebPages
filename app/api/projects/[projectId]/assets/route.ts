import { env } from 'cloudflare:workers';
import { handleListAssets, handleUploadAsset } from '@/resources/assets/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  return handleListAssets(request, env, projectId);
}

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  return handleUploadAsset(request, env, projectId);
}
