export async function isAssetInActivePublishedVersion(
  database: D1Database,
  projectId: string,
  assetId: string,
) {
  try {
    const result = await database.prepare(`
      SELECT 1 AS "referenced"
      FROM projects AS project
      INNER JOIN site_versions AS version
        ON version.id = project.published_version_id
        AND version.project_id = project.id
      INNER JOIN assets AS asset
        ON asset.project_id = project.id
        AND asset.id = ?
      INNER JOIN json_each(version.referenced_asset_ids_json) AS reference
        ON reference.type = 'text'
        AND reference.value = asset.id
      WHERE project.id = ?
      LIMIT 1
    `).bind(assetId, projectId).first<{ referenced: number }>();

    return result !== null;
  } catch {
    return false;
  }
}
