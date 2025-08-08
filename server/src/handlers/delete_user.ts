import { db } from '../db';
import { usersTable, loansTable } from '../db/schema';
import { eq, and, or } from 'drizzle-orm';

export async function deleteUser(userId: number): Promise<{ success: boolean }> {
  try {
    // First, validate that the user exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (existingUser.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Check if user is already inactive
    if (!existingUser[0].is_active) {
      throw new Error(`User with ID ${userId} is already inactive`);
    }

    // Check if user has outstanding loans (active or pending)
    const outstandingLoans = await db.select()
      .from(loansTable)
      .where(
        and(
          eq(loansTable.user_id, userId),
          or(
            eq(loansTable.status, 'active'),
            eq(loansTable.status, 'pending'),
            eq(loansTable.status, 'approved')
          )
        )
      )
      .execute();

    if (outstandingLoans.length > 0) {
      throw new Error(`Cannot deactivate user: has ${outstandingLoans.length} outstanding loan(s)`);
    }

    // Soft delete by setting is_active to false
    await db.update(usersTable)
      .set({ 
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, userId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('User deletion failed:', error);
    throw error;
  }
}