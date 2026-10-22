import { describe, expect, it, vi } from 'vitest';
import { isAssetInActivePublishedVersion } from '../../server/published-assets';

function database(result: { referenced: number } | null) {
  const statement = {
    bind: vi.fn(),
    first: vi.fn().mockResolvedValue(result),
  };
  statement.bind.mockReturnValue(statement);
  const db = { prepare: vi.fn().mockReturnValue(statement) } as unknown as D1Database;
  return { db, statement };
}

describe('public asset visibility', () => {
  it('requires the asset to belong to the project and appear in its active published snapshot', async () => {
    const { db, statement } = database({ referenced: 1 });

    await expect(isAssetInActivePublishedVersion(db, 'project-id', 'asset-id'))
      .resolves.toBe(true);

    const [query] = vi.mocked(db.prepare).mock.calls[0];
    expect(query).toContain('project.published_version_id');
    expect(query).toContain('asset.project_id = project.id');
    expect(query).toContain('json_each(version.referenced_asset_ids_json)');
    expect(statement.bind).toHaveBeenCalledWith('asset-id', 'project-id');
  });

  it('keeps assets private when no active snapshot references them or D1 is unavailable', async () => {
    const missing = database(null);
    await expect(isAssetInActivePublishedVersion(missing.db, 'project-id', 'draft-only-asset'))
      .resolves.toBe(false);

    const failingDb = {
      prepare: vi.fn(() => { throw new Error('database detail'); }),
    } as unknown as D1Database;
    await expect(isAssetInActivePublishedVersion(failingDb, 'project-id', 'asset-id'))
      .resolves.toBe(false);
  });
});
