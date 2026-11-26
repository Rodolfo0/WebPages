import { env } from 'cloudflare:workers';
import { handleCreateFormSubmission } from '@/resources/messages/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  return handleCreateFormSubmission(request, env, slug);
}
