import { eq } from 'drizzle-orm';
import { users } from './schema';
import { createDb } from './client';

export async function ensureLocalUser(
  database: D1Database,
  identity: { id: string; email: string },
): Promise<string> {
  const subject = identity.id.trim();
  const email = identity.email.trim();
  if (!subject || !email) throw new Error('A validated auth identity is required.');

  const db = createDb(database);
  const [existing] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.authSubject, subject))
    .limit(1);

  if (existing) {
    if (existing.email !== email) {
      await db.update(users)
        .set({ email, updatedAt: new Date() })
        .where(eq(users.id, existing.id));
    }
    return existing.id;
  }

  const [created] = await db
    .insert(users)
    .values({ authSubject: subject, email })
    .onConflictDoNothing({ target: users.authSubject })
    .returning({ id: users.id });

  if (created?.id) return created.id;

  // Another request may have inserted the same provider subject concurrently.
  const [concurrent] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.authSubject, subject))
    .limit(1);

  if (concurrent) {
    if (concurrent.email !== email) {
      await db.update(users)
        .set({ email, updatedAt: new Date() })
        .where(eq(users.id, concurrent.id));
    }
    return concurrent.id;
  }

  throw new Error('The local user could not be resolved.');
}
