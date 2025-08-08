import { db } from '../db';
import { accountsTable, usersTable } from '../db/schema';
import { type Account } from '../schema';
import { eq } from 'drizzle-orm';

export const getSavingsBalance = async (userId: number): Promise<Account> => {
  try {
    // First verify the user exists
    const userExists = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .execute();

    if (userExists.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Get the user's savings account
    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.user_id, userId))
      .limit(1)
      .execute();

    if (accounts.length === 0) {
      throw new Error(`No savings account found for user ID ${userId}`);
    }

    const account = accounts[0];

    // Convert numeric field back to number before returning
    return {
      ...account,
      balance: parseFloat(account.balance) // Convert string back to number
    };
  } catch (error) {
    console.error('Get savings balance failed:', error);
    throw error;
  }
};