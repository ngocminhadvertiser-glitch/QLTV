import { db } from './index.ts';
import { users, userRoles, roles } from './schema.ts';
import { eq } from 'drizzle-orm';

export interface UserRecord {
  id: string;
  uid: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  fullName: string = '',
  avatarUrl: string = ''
): Promise<UserRecord> {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);

    if (existing.length > 0) {
      // Update info if changed
      const [updated] = await db
        .update(users)
        .set({
          email,
          fullName: fullName || existing[0].fullName,
          avatarUrl: avatarUrl || existing[0].avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.uid, uid))
        .returning();
      return updated;
    }

    // Determine initial role: First user is admin, or can be specified
    const totalUsers = await db.select().from(users);
    const initialRole = totalUsers.length === 0 ? 'admin' : 'student';

    const [newUser] = await db
      .insert(users)
      .values({
        uid,
        email,
        fullName: fullName || email.split('@')[0],
        avatarUrl: avatarUrl || null,
        role: initialRole,
        status: 'active',
      })
      .returning();

    // Also record in userRoles
    await db.insert(userRoles).values({
      userId: newUser.id,
      roleName: initialRole,
    });

    return newUser;
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    throw new Error('Database operation failed for user profile', { cause: error });
  }
}

export async function getUserByUid(uid: string): Promise<UserRecord | null> {
  try {
    const records = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return records[0] || null;
  } catch (error) {
    console.error('Error in getUserByUid:', error);
    throw new Error('Failed to fetch user by UID', { cause: error });
  }
}

export async function updateUserRole(userId: string, newRole: string): Promise<UserRecord | null> {
  try {
    const [updated] = await db
      .update(users)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (updated) {
      await db.delete(userRoles).where(eq(userRoles.userId, userId));
      await db.insert(userRoles).values({
        userId,
        roleName: newRole,
      });
    }

    return updated || null;
  } catch (error) {
    console.error('Error updating user role:', error);
    throw new Error('Failed to update user role', { cause: error });
  }
}

export async function getAllUsers(): Promise<UserRecord[]> {
  try {
    return await db.select().from(users).orderBy(users.createdAt);
  } catch (error) {
    console.error('Error fetching all users:', error);
    throw new Error('Failed to fetch users list', { cause: error });
  }
}
