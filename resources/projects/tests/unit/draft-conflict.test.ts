import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb } from '../../../../database/d1/client';
import { createPortfolioTemplate } from '../../domain/portfolio-template';
import { ProjectDraftConflictError, updateProject } from '../../server/manage-projects';

vi.mock('../../../../database/d1/client', () => ({ createDb: vi.fn() }));

function mockDatabase({ updated, current }: { updated: unknown[]; current: unknown[] }) {
  const updateChain = {
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn().mockResolvedValue(updated),
  };
  updateChain.set.mockReturnValue(updateChain);
  updateChain.where.mockReturnValue(updateChain);

  const selectChain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(current),
  };
  selectChain.from.mockReturnValue(selectChain);
  selectChain.where.mockReturnValue(selectChain);

  vi.mocked(createDb).mockReturnValue({
    update: vi.fn().mockReturnValue(updateChain),
    select: vi.fn().mockReturnValue(selectChain),
  } as unknown as ReturnType<typeof createDb>);
  return updateChain;
}

describe('draft revision control', () => {
  const database = {} as D1Database;
  const authUser = { id: 'supabase-subject', email: 'owner@example.test' };
  const draftDocument = createPortfolioTemplate('Alex Rivera', 'alex-rivera');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('advances the revision when the draft is saved on the current revision', async () => {
    const updateChain = mockDatabase({
      updated: [{ id: 'project-1', name: 'Alex', slug: 'alex-rivera', updatedAt: new Date(), draftRevision: 4 }],
      current: [],
    });

    await expect(updateProject(database, authUser, 'project-1', { draftDocument, draftRevision: 3 }))
      .resolves.toMatchObject({ draftRevision: 4 });
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      draftDocumentJson: JSON.stringify(draftDocument),
      draftRevision: expect.anything(),
    }));
  });

  it('rejects a draft based on an older revision', async () => {
    mockDatabase({ updated: [], current: [{ id: 'project-1', draftRevision: 5 }] });

    const error = await updateProject(database, authUser, 'project-1', { draftDocument, draftRevision: 3 })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProjectDraftConflictError);
    expect(error).toMatchObject({ code: 'project_draft_conflict', status: 409 });
  });

  it('keeps the access denial when the user cannot update the project', async () => {
    mockDatabase({ updated: [], current: [] });

    await expect(updateProject(database, authUser, 'project-1', { draftDocument, draftRevision: 3 }))
      .rejects.toMatchObject({ code: 'project_access_denied' });
  });
});
