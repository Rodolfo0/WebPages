import type { AuthUser } from '../../auth';
import { withAuthUser } from '../../auth/server';
import { AssetInputError, AssetUploadError } from '../domain/asset';
import { listProjectAssets, uploadProjectAsset } from './manage-assets';
import { ProjectAccessError } from '../../projects/domain/access';
import { eq } from 'drizzle-orm';
import { assets } from '../../../database/d1/schema';
import { createDb } from '../../../database/d1/client';
import { isAssetInActivePublishedVersion } from '../../projects/server/published-assets';
import { requireProjectPermission } from '../../projects/server/access';

type AssetBindings = {
  DB?: D1Database;
  FILES?: R2Bucket;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

function assetErrorResponse(error: unknown) {
  if (error instanceof AssetInputError || error instanceof AssetUploadError) {
    return json({ error: error.code, message: error.message }, error.status);
  }
  if (error instanceof ProjectAccessError) {
    return json({ error: error.code, message: error.message }, error.status);
  }
  return json({ error: 'asset_unavailable', message: 'No se pudo completar la operación de imágenes.' }, 503);
}

export function handleListAssets(request: Request, bindings: AssetBindings, projectId: string) {
  if (!bindings.DB) return json({ error: 'asset_unavailable', message: 'No se pudo acceder al almacenamiento de proyectos.' }, 503);
  return withAuthUser(request, bindings, async (user: AuthUser) => {
    try {
      return json({ assets: await listProjectAssets(bindings.DB!, bindings.FILES, user, projectId) });
    } catch (error) {
      return assetErrorResponse(error);
    }
  });
}

export async function handleAssetDelivery(request: Request, bindings: AssetBindings, assetId: string) {
  if (!bindings.DB || !bindings.FILES) {
    return json({ error: 'asset_unavailable', message: 'El almacenamiento de imágenes no está disponible.' }, 503);
  }

  try {
    const db = createDb(bindings.DB);
    const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
    if (!asset) return json({ error: 'asset_not_found', message: 'La imagen no existe.' }, 404);

    const published = await isAssetInActivePublishedVersion(bindings.DB, asset.projectId, assetId);

    const serve = async () => {
      const object = await bindings.FILES!.get(asset.r2Key);
      if (!object) return json({ error: 'asset_not_found', message: 'La imagen no existe en almacenamiento.' }, 404);
      return new Response(object.body, {
        headers: {
          'Content-Type': asset.contentType,
          'Content-Length': String(asset.byteSize),
          'Cache-Control': published ? 'public, max-age=3600' : 'private, no-store',
          'Content-Disposition': 'inline',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    };

    if (published) return serve();

    return withAuthUser(request, bindings, async (user: AuthUser) => {
      try {
        await requireProjectPermission(bindings.DB!, user, asset.projectId, 'assets:read');
        return serve();
      } catch (error) {
        return assetErrorResponse(error);
      }
    });
  } catch (error) {
    return assetErrorResponse(error);
  }
}

export function handleUploadAsset(request: Request, bindings: AssetBindings, projectId: string) {
  if (!bindings.DB) return json({ error: 'asset_unavailable', message: 'No se pudo acceder al almacenamiento de proyectos.' }, 503);
  return withAuthUser(request, bindings, async (user: AuthUser) => {
    try {
      const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (contentType !== 'multipart/form-data') throw new AssetInputError('Envía la imagen como multipart/form-data.');
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) throw new AssetInputError('Selecciona una imagen para subirla.');
      const asset = await uploadProjectAsset(bindings.DB!, bindings.FILES, user, projectId, file);
      return json({ asset }, 201);
    } catch (error) {
      return assetErrorResponse(error);
    }
  });
}
