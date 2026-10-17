import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, defaultName?: string) {
  try {
    const result = await db.insert(users)
      .values({
        uid,
        email,
        username: email.split('@')[0],
        fullName: defaultName || email.split('@')[0],
        role: 'SUPER_ADMIN',
        department: 'Direksi & Operasional',
        operatorCode: `OPR-${uid.slice(0, 5).toUpperCase()}`,
        pin: '1234',
        status: 'ACTIVE',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query getOrCreateUser failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error('Database query getUsers failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
