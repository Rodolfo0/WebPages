import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureLocalUser } from '../../../../database/d1/local-users';
import { users } from '../../../../database/d1/schema';
import { createDb } from '../../../../database/d1/client';

vi.mock('../../../../database/d1/client', () => ({ createDb: vi.fn() }));

function selection(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  return { query: { from }, where, limit };
}

describe('local auth identity synchronization', () => {
  const database = {} as D1Database;
  let select: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let insert: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    select = vi.fn();
    update = vi.fn();
    insert = vi.fn();
    vi.mocked(createDb).mockReturnValue({ select, update, insert } as unknown as ReturnType<typeof createDb>);
  });

  it('returns the existing internal ID without writing when the email is unchanged', async () => {
    const first = selection([{ id: 'local-user-id', email: 'user@example.test' }]);
    select.mockReturnValue(first.query);

    await expect(ensureLocalUser(database, {
      id: 'supabase-subject', email: ' user@example.test ',
    })).resolves.toBe('local-user-id');

    expect(createDb).toHaveBeenCalledWith(database);
    expect(first.query.from).toHaveBeenCalledWith(users);
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts by provider subject and returns the internal D1 user ID', async () => {
    const first = selection([]);
    select.mockReturnValue(first.query);
    const returning = vi.fn().mockResolvedValue([{ id: 'local-user-id' }]);
    const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    insert.mockReturnValue({ values });

    await expect(ensureLocalUser(database, {
      id: 'supabase-subject', email: ' user@example.test ',
    })).resolves.toBe('local-user-id');

    expect(values).toHaveBeenCalledWith({
      authSubject: 'supabase-subject',
      email: 'user@example.test',
    });
    expect(onConflictDoNothing).toHaveBeenCalledWith({ target: users.authSubject });
    expect(returning).toHaveBeenCalledWith({ id: users.id });
  });

  it('rejects an identity without the provider subject or email', async () => {
    await expect(ensureLocalUser(database, { id: ' ', email: 'user@example.test' }))
      .rejects.toThrow('A validated auth identity is required.');
    expect(createDb).not.toHaveBeenCalled();
  });

  it('fails closed if a concurrent insert cannot be resolved', async () => {
    const first = selection([]);
    const second = selection([]);
    select.mockReturnValueOnce(first.query).mockReturnValueOnce(second.query);
    const returning = vi.fn().mockResolvedValue([]);
    const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
    insert.mockReturnValue({
      values: vi.fn().mockReturnValue({ onConflictDoNothing }),
    });

    await expect(ensureLocalUser(database, {
      id: 'supabase-subject', email: 'user@example.test',
    })).rejects.toThrow('The local user could not be resolved.');
  });
});
