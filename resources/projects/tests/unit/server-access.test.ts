import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb } from '../../../../database/d1/client';
import { projectMembers, projectRolePermissions, projectRoles, projects, users } from '../../../../database/d1/schema';
import { ProjectAccessError, requireProjectPermission } from '../../server/access';

vi.mock('../../../../database/d1/client', () => ({ createDb: vi.fn() }));

function query(result: unknown[]) {
  const chain = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(result),
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

describe('server project permission checks', () => {
  const database = {} as D1Database;
  const authUser = { id: 'supabase-subject', email: 'owner@example.test' };
  let select: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    select = vi.fn();
  });

  it('resolves the provider subject to the internal user ID and grants the system owner all permissions', async () => {
    const localUserQuery = query([{ id: 'internal-user-id' }]);
    const membershipQuery = query([{
      userId: 'internal-user-id', roleId: 'owner-role', roleKind: 'system_owner',
      status: 'active', permissionCode: null,
    }]);
    select.mockReturnValueOnce(localUserQuery).mockReturnValueOnce(membershipQuery);
    vi.mocked(createDb).mockReturnValue({ select } as unknown as ReturnType<typeof createDb>);

    await expect(requireProjectPermission(database, authUser, 'project-1', 'project:delete'))
      .resolves.toEqual({
        userId: 'internal-user-id',
        projectId: 'project-1',
        roleId: 'owner-role',
        roleKind: 'system_owner',
      });

    expect(localUserQuery.from).toHaveBeenCalledWith(users);
    expect(membershipQuery.from).toHaveBeenCalledWith(projectMembers);
    expect(membershipQuery.innerJoin).toHaveBeenCalledWith(projects, expect.anything());
    expect(membershipQuery.innerJoin).toHaveBeenCalledWith(projectRoles, expect.anything());
    expect(membershipQuery.leftJoin).toHaveBeenCalledWith(projectRolePermissions, expect.anything());
  });

  it('requires an explicit matching permission for custom roles', async () => {
    const localUserQuery = query([{ id: 'internal-user-id' }]);
    const membershipQuery = query([{
      userId: 'internal-user-id', roleId: 'editor-role', roleKind: 'custom',
      status: 'active', permissionCode: null,
    }]);
    select.mockReturnValueOnce(localUserQuery).mockReturnValueOnce(membershipQuery);
    vi.mocked(createDb).mockReturnValue({ select } as unknown as ReturnType<typeof createDb>);

    await expect(requireProjectPermission(database, authUser, 'project-1', 'messages:read'))
      .rejects.toMatchObject({ code: 'project_access_denied', status: 404 });
  });

  it('uses one denial for missing local users, missing memberships, and changed project IDs', async () => {
    const localUserQuery = query([{ id: 'internal-user-id' }]);
    const membershipQuery = query([]);
    select.mockReturnValueOnce(localUserQuery).mockReturnValueOnce(membershipQuery);
    vi.mocked(createDb).mockReturnValue({ select } as unknown as ReturnType<typeof createDb>);

    const first = await requireProjectPermission(database, authUser, 'project-from-request', 'project:read')
      .catch((error) => error);

    expect(first).toBeInstanceOf(ProjectAccessError);
    expect(first).toMatchObject({ code: 'project_access_denied', status: 404 });
    expect(membershipQuery.where).toHaveBeenCalledOnce();
  });

  it('returns a generic service error when D1 cannot verify access', async () => {
    select.mockImplementation(() => { throw new Error('database query detail'); });
    vi.mocked(createDb).mockReturnValue({ select } as unknown as ReturnType<typeof createDb>);

    const error = await requireProjectPermission(database, authUser, 'project-1', 'project:read')
      .catch((caught) => caught);

    expect(error).toMatchObject({ code: 'project_access_unavailable', status: 503 });
    expect(error.message).not.toContain('database query detail');
  });
});
