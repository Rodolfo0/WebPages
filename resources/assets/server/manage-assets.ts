import { and, desc, eq } from 'drizzle-orm';
import { assets } from '../../../database/d1/schema';
import { createDb } from '../../../database/d1/client';
import type { AuthUser } from '../../auth';
import { requireProjectPermission } from '../../projects/server/access';
import { assetObjectKey, AssetUploadError, type AssetRecord, validateAssetUpload } from '../domain/asset';

export async function listProjectAssets(database: D1Database, files: R2Bucket | undefined, authUser: AuthUser, projectId: string) {
  await requireProjectPermission(database, authUser, projectId, 'assets:read');
  void files;
  const db = createDb(database);
  const rows = await db.select().from(assets).where(eq(assets.projectId, projectId)).orderBy(desc(assets.createdAt));
  return rows.map((row): AssetRecord => ({
    id: row.id,
    projectId: row.projectId,
    filename: row.filename,
    contentType: row.contentType,
    byteSize: row.byteSize,
    altText: row.altText,
    createdAt: new Date(row.createdAt).toISOString(),
  }));
}

export async function uploadProjectAsset(database: D1Database, files: R2Bucket | undefined, authUser: AuthUser, projectId: string, file: File) {
  await requireProjectPermission(database, authUser, projectId, 'assets:manage');
  validateAssetUpload(file);
  if (!files) throw new AssetUploadError('El almacenamiento de imágenes todavía no está configurado.');

  const assetId = crypto.randomUUID();
  const r2Key = assetObjectKey(projectId, assetId, file.type);
  const bytes = await file.arrayBuffer();

  try {
    await files.put(r2Key, bytes, {
      httpMetadata: { contentType: file.type },
    });
  } catch {
    throw new AssetUploadError();
  }

  try {
    const db = createDb(database);
    await db.insert(assets).values({
      id: assetId,
      projectId,
      r2Key,
      filename: file.name.normalize('NFKC').trim().slice(0, 255) || assetId,
      contentType: file.type,
      byteSize: bytes.byteLength,
      altText: null,
    });
  } catch (error) {
    await files.delete(r2Key);
    throw error;
  }

  return {
    id: assetId,
    projectId,
    filename: file.name.normalize('NFKC').trim().slice(0, 255) || assetId,
    contentType: file.type,
    byteSize: bytes.byteLength,
    altText: null,
    createdAt: new Date().toISOString(),
  } satisfies AssetRecord;
}

export async function getProjectAsset(database: D1Database, authUser: AuthUser, projectId: string, assetId: string) {
  await requireProjectPermission(database, authUser, projectId, 'assets:read');
  const db = createDb(database);
  const [asset] = await db.select().from(assets).where(and(eq(assets.projectId, projectId), eq(assets.id, assetId))).limit(1);
  return asset ?? null;
}
