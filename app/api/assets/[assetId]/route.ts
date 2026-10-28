import { env } from 'cloudflare:workers';
import { handleAssetDelivery } from '@/resources/assets/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ assetId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { assetId } = await context.params;
  return handleAssetDelivery(request, env, assetId);
}
