import { env } from 'cloudflare:workers';
import { handleDeleteAsset, handleRenameAsset } from '@/resources/assets/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ projectId: string; assetId: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const { projectId, assetId } = await context.params;
  return handleDeleteAsset(request, env, projectId, assetId);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { projectId, assetId } = await context.params;
  return handleRenameAsset(request, env, projectId, assetId);
}
