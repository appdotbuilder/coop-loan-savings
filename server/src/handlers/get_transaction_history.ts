import { db } from '../db';
import { transactionsTable, accountsTable, usersTable } from '../db/schema';
import { type Transaction } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getTransactionHistory = async (userId: number): Promise<Transaction[]> => {
  try {
    // First verify the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Get the user's account
    const account = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.user_id, userId))
      .execute();

    if (account.length === 0) {
      throw new Error(`No account found for user ID ${userId}`);
    }

    // Get all transactions for the user's account, ordered by newest first
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.account_id, account[0].id))
      .orderBy(desc(transactionsTable.created_at))
      .execute();

    // Convert numeric fields back to numbers before returning
    return transactions.map(transaction => ({
      ...transaction,
      amount: parseFloat(transaction.amount)
    }));
  } catch (error) {
    console.error('Get transaction history failed:', error);
    throw error;
  }
};