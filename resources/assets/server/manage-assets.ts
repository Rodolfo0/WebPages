import { and, desc, eq } from 'drizzle-orm';
import { assets } from '../../../database/d1/schema';
import { projects } from '../../../database/d1/schema';
import { createDb } from '../../../database/d1/client';
import type { AuthUser } from '../../auth';
import { requireProjectPermission } from '../../projects/server/access';
import { findMissingContentImageAltPaths, populateMissingContentImageAlt, portfolioBlockRegistry, toBlockSchemaRegistry } from '../../blocks';
import { collectSiteDocumentAssetIds } from '../../site-document';
import type { SiteDocument } from '../../site-document';
import {
  assetObjectKey,
  AssetQuotaError,
  AssetUploadError,
  MAX_ASSET_BYTES_PER_PROJECT,
  MAX_ASSET_BYTES_PER_USER,
  MAX_ASSETS_PER_PROJECT,
  MAX_ASSETS_PER_USER,
  type AssetRecord,
  validateAssetFilename,
  validateAssetImageDimensions,
  validateAssetUpload,
} from '../domain/asset';

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
  const access = await requireProjectPermission(database, authUser, projectId, 'assets:manage');
  validateAssetUpload(file);
  if (!files) throw new AssetUploadError('El almacenamiento de imágenes todavía no está configurado.');

  let usage: {
    projectAssetCount: number;
    projectByteSize: number;
    userAssetCount: number;
    userByteSize: number;
  } | null;
  try {
    usage = await database.prepare(`
      SELECT
        (SELECT COUNT(*) FROM assets WHERE project_id = ?) AS "projectAssetCount",
        (SELECT COALESCE(SUM(byte_size), 0) FROM assets WHERE project_id = ?) AS "projectByteSize",
        (
          SELECT COUNT(*) FROM assets AS asset
          LEFT JOIN projects AS project ON project.id = asset.project_id
          WHERE COALESCE(asset.uploaded_by_user_id, project.created_by) = ?
        ) AS "userAssetCount",
        (
          SELECT COALESCE(SUM(asset.byte_size), 0) FROM assets AS asset
          LEFT JOIN projects AS project ON project.id = asset.project_id
          WHERE COALESCE(asset.uploaded_by_user_id, project.created_by) = ?
        ) AS "userByteSize"
    `).bind(projectId, projectId, access.userId, access.userId).first();
  } catch {
    throw new AssetUploadError('No se pudo comprobar la cuota de almacenamiento.');
  }
  if (!usage) throw new AssetUploadError('No se pudo comprobar la cuota de almacenamiento.');
  if (usage.projectAssetCount >= MAX_ASSETS_PER_PROJECT || usage.projectByteSize + file.size > MAX_ASSET_BYTES_PER_PROJECT) {
    throw new AssetQuotaError('El proyecto alcanzó su cuota de 50 imágenes o 100 MiB.');
  }
  if (usage.userAssetCount >= MAX_ASSETS_PER_USER || usage.userByteSize + file.size > MAX_ASSET_BYTES_PER_USER) {
    throw new AssetQuotaError('Tu cuenta alcanzó su cuota de 250 imágenes o 500 MiB.');
  }

  const assetId = crypto.randomUUID();
  const r2Key = assetObjectKey(projectId, assetId, file.type);
  const bytes = await file.arrayBuffer();
  validateAssetImageDimensions(file.type, new Uint8Array(bytes));
  const filename = file.name.normalize('NFKC').trim().slice(0, 255) || assetId;

  try {
    await files.put(r2Key, bytes, {
      httpMetadata: { contentType: file.type },
    });
  } catch {
    throw new AssetUploadError();
  }

  try {
    const result = await database.prepare(`
      INSERT INTO assets (id, project_id, uploaded_by_user_id, r2_key, filename, content_type, byte_size, alt_text)
      SELECT ?, ?, ?, ?, ?, ?, ?, NULL
      WHERE
        (SELECT COUNT(*) FROM assets WHERE project_id = ?) < ?
        AND (SELECT COALESCE(SUM(byte_size), 0) FROM assets WHERE project_id = ?) + ? <= ?
        AND (
          SELECT COUNT(*) FROM assets AS asset
          LEFT JOIN projects AS project ON project.id = asset.project_id
          WHERE COALESCE(asset.uploaded_by_user_id, project.created_by) = ?
        ) < ?
        AND (
          SELECT COALESCE(SUM(asset.byte_size), 0) FROM assets AS asset
          LEFT JOIN projects AS project ON project.id = asset.project_id
          WHERE COALESCE(asset.uploaded_by_user_id, project.created_by) = ?
        ) + ? <= ?
    `).bind(
      assetId,
      projectId,
      access.userId,
      r2Key,
      filename,
      file.type,
      bytes.byteLength,
      projectId,
      MAX_ASSETS_PER_PROJECT,
      projectId,
      bytes.byteLength,
      MAX_ASSET_BYTES_PER_PROJECT,
      access.userId,
      MAX_ASSETS_PER_USER,
      access.userId,
      bytes.byteLength,
      MAX_ASSET_BYTES_PER_USER,
    ).run();
    if ((result.meta?.changes ?? 0) !== 1) throw new AssetQuotaError();
  } catch (error) {
    try {
      await files.delete(r2Key);
    } catch {
      // Failed uploads are never recorded as assets; an orphaned object remains inaccessible.
    }
    throw error;
  }

  return {
    id: assetId,
    projectId,
    filename,
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

export async function renameProjectAsset(
  database: D1Database,
  authUser: AuthUser,
  projectId: string,
  assetId: string,
  filename: unknown,
) {
  await requireProjectPermission(database, authUser, projectId, 'assets:manage');
  const nextFilename = validateAssetFilename(filename);
  const db = createDb(database);
  const [asset] = await db.select().from(assets)
    .where(and(eq(assets.projectId, projectId), eq(assets.id, assetId))).limit(1);
  if (!asset) return null;

  await db.update(assets).set({ filename: nextFilename })
    .where(and(eq(assets.projectId, projectId), eq(assets.id, assetId)));

  return {
    id: asset.id,
    projectId: asset.projectId,
    filename: nextFilename,
    contentType: asset.contentType,
    byteSize: asset.byteSize,
    altText: asset.altText,
    createdAt: new Date(asset.createdAt).toISOString(),
  } satisfies AssetRecord;
}

export async function deleteProjectAsset(database: D1Database, files: R2Bucket | undefined, authUser: AuthUser, projectId: string, assetId: string) {
  await requireProjectPermission(database, authUser, projectId, 'assets:manage');
  if (!files) throw new AssetUploadError('El almacenamiento de imágenes todavía no está configurado.');

  const db = createDb(database);
  const [asset] = await db.select().from(assets)
    .where(and(eq(assets.projectId, projectId), eq(assets.id, assetId))).limit(1);
  if (!asset) return null;
  const [project] = await db.select({
    draftDocumentJson: projects.draftDocumentJson,
    draftRevision: projects.draftRevision,
  })
    .from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return null;

  let draftDocument: SiteDocument;
  let referencedAssetIds: string[];
  try {
    const rawDraft = JSON.parse(project.draftDocumentJson) as unknown;
    const missingAltPaths = findMissingContentImageAltPaths(rawDraft);
    draftDocument = (missingAltPaths.length > 0
      ? populateMissingContentImageAlt(rawDraft, new Map((await db.select({ id: assets.id, filename: assets.filename })
        .from(assets)
        .where(eq(assets.projectId, projectId)))
        .map((entry) => [entry.id, entry.filename])))
      : rawDraft) as SiteDocument;
    referencedAssetIds = collectSiteDocumentAssetIds(toBlockSchemaRegistry(portfolioBlockRegistry), draftDocument);
  } catch {
    throw new AssetUploadError('No se pudo validar el borrador para eliminar la imagen.');
  }

  let publishedReference: { referenced: number } | null;
  try {
    publishedReference = await database.prepare(`
      SELECT 1 AS "referenced"
      FROM projects AS project
      INNER JOIN site_versions AS version
        ON version.id = project.published_version_id AND version.project_id = project.id
      INNER JOIN json_each(version.referenced_asset_ids_json) AS reference
        ON reference.type = 'text' AND reference.value = ?
      WHERE project.id = ? LIMIT 1
    `).bind(assetId, projectId).first<{ referenced: number }>();
  } catch {
    throw new AssetUploadError('No se pudo comprobar si la imagen está en uso.');
  }
  if (publishedReference !== null) {
    return {
      error: 'asset_in_use' as const,
      message: 'La imagen sigue en uso en la publicación activa. Publica una versión que ya no la use antes de eliminarla.',
    };
  }

  const replaceReferences = (value: unknown, parentKey = ''): unknown => {
    if (parentKey === 'imageAssetId' && value === assetId) return '';
    if (Array.isArray(value)) return value.map((item) => replaceReferences(item));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceReferences(child, key)]));
  };
  const nextDraftDocument = referencedAssetIds.includes(assetId)
    ? { ...draftDocument, pages: draftDocument.pages.map((page: { blocks: Array<{ props: unknown }> }) => ({
        ...page,
        blocks: page.blocks.map((block) => ({ ...block, props: replaceReferences(block.props) })),
      })) }
    : draftDocument;
  try {
    collectSiteDocumentAssetIds(toBlockSchemaRegistry(portfolioBlockRegistry), nextDraftDocument);
  } catch {
    throw new AssetUploadError('No se pudo validar el borrador actualizado.');
  }

  const statements = [];
  if (referencedAssetIds.includes(assetId)) {
    statements.push(database.prepare(`
      UPDATE projects
      SET draft_document_json = ?, draft_revision = draft_revision + 1, updated_at = ?
      WHERE id = ? AND draft_revision = ?
    `).bind(JSON.stringify(nextDraftDocument), Date.now(), projectId, project.draftRevision));
  }
  statements.push(database.prepare(`
    DELETE FROM assets
    WHERE id = ? AND project_id = ?
      AND NOT EXISTS (
        SELECT 1 FROM projects AS project, json_tree(project.draft_document_json) AS value
        WHERE project.id = assets.project_id
          AND value.key = 'imageAssetId'
          AND value.value = assets.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM projects AS project
        INNER JOIN site_versions AS version
          ON version.id = project.published_version_id AND version.project_id = project.id
        INNER JOIN json_each(version.referenced_asset_ids_json) AS reference
          ON reference.type = 'text' AND reference.value = assets.id
        WHERE project.id = assets.project_id
      )
  `).bind(assetId, projectId));
  const results = await database.batch(statements);
  const deletionResult = results[results.length - 1];
  if ((deletionResult.meta?.changes ?? 0) !== 1) {
    return {
      error: 'asset_in_use' as const,
      message: 'La imagen sigue en uso en el borrador o la publicación activa. Quita la imagen de los bloques y publica una versión actualizada antes de eliminarla.',
    };
  }

  // Metadata and draft references are already removed atomically. A failed R2 cleanup leaves only
  // an unreachable object, not a broken asset row or a placeholder in the editor.
  try {
    await files.delete(asset.r2Key);
  } catch {
    console.error('Asset bytes could not be removed from R2 after D1 deletion.');
  }
  return {
    deleted: true as const,
    draftDocument: nextDraftDocument,
    draftRevision: referencedAssetIds.includes(assetId) ? project.draftRevision + 1 : project.draftRevision,
  };
}
