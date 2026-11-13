import type { AuthUser } from '../../auth';
import { withAuthUser } from '../../auth/server';
import { AssetInUseError, AssetInputError, AssetUploadError } from '../domain/asset';
import { deleteProjectAsset, listProjectAssets, renameProjectAsset, uploadProjectAsset } from './manage-assets';
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

const MAX_ASSET_RENAME_REQUEST_BYTES = 4 * 1024;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

function assetErrorResponse(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'asset_in_use') {
    const message = 'message' in error && typeof error.message === 'string'
      ? error.message
      : 'Esta imagen todavía está en uso. Quita la imagen de la publicación activa antes de eliminarla.';
    return json({ error: 'asset_in_use', message }, 409);
  }
  if (error instanceof AssetInUseError || error instanceof AssetInputError || error instanceof AssetUploadError) {
    return json({ error: error.code, message: error.message }, error.status);
  }
  if (error instanceof ProjectAccessError) {
    return json({ error: error.code, message: error.message }, error.status);
  }
  return json({ error: 'asset_unavailable', message: 'No se pudo completar la operación de imágenes.' }, 503);
}

async function readAssetRenamePayload(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') throw new AssetInputError('Envía el nombre de la imagen como JSON.');

  const declaredLength = request.headers.get('content-length');
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_ASSET_RENAME_REQUEST_BYTES)) {
    throw new AssetInputError('La solicitud para renombrar la imagen es demasiado grande.');
  }

  if (!request.body) throw new AssetInputError('La solicitud para renombrar la imagen no es válida.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_ASSET_RENAME_REQUEST_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw new AssetInputError('La solicitud para renombrar la imagen es demasiado grande.');
      }
      chunks.push(value);
    }
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    if (error instanceof AssetInputError) throw error;
    throw new AssetInputError('No se pudo leer la solicitud para renombrar la imagen.');
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new AssetInputError('La solicitud para renombrar la imagen no es válida.');
  }
}

export function handleDeleteAsset(request: Request, bindings: AssetBindings, projectId: string, assetId: string) {
  if (!bindings.DB) return json({ error: 'asset_unavailable', message: 'No se pudo acceder al almacenamiento de proyectos.' }, 503);
  return withAuthUser(request, bindings, async (user: AuthUser) => {
    try {
      const result = await deleteProjectAsset(bindings.DB!, bindings.FILES, user, projectId, assetId);
      if (result && 'error' in result && result.error === 'asset_in_use') {
        return json(result, 409);
      }
      return result ? json(result) : json({ error: 'asset_not_found', message: 'La imagen no existe.' }, 404);
    } catch (error) {
      if (
        error instanceof AssetInputError
        || error instanceof AssetUploadError
        || error instanceof ProjectAccessError
        || (error !== null && typeof error === 'object' && 'code' in error && error.code === 'asset_in_use')
      ) return assetErrorResponse(error);
      return json({
        error: 'asset_delete_failed',
        message: 'No se pudo eliminar la imagen y no se actualizó el borrador. Inténtalo de nuevo.',
      }, 503);
    }
  });
}

export function handleRenameAsset(request: Request, bindings: AssetBindings, projectId: string, assetId: string) {
  if (!bindings.DB) return json({ error: 'asset_unavailable', message: 'No se pudo acceder al almacenamiento de proyectos.' }, 503);
  return withAuthUser(request, bindings, async (user: AuthUser) => {
    try {
      await requireProjectPermission(bindings.DB!, user, projectId, 'assets:manage');
      const payload = await readAssetRenamePayload(request);
      const filename = payload && typeof payload === 'object' && 'filename' in payload
        ? payload.filename
        : undefined;
      const asset = await renameProjectAsset(bindings.DB!, user, projectId, assetId, filename);
      return asset ? json({ asset }) : json({ error: 'asset_not_found', message: 'La imagen no existe.' }, 404);
    } catch (error) {
      return assetErrorResponse(error);
    }
  });
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
