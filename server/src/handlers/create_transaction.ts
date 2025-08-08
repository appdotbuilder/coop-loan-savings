import { db } from '../db';
import { transactionsTable, accountsTable, usersTable } from '../db/schema';
import { type CreateTransactionInput, type Transaction } from '../schema';
import { eq } from 'drizzle-orm';

export const createTransaction = async (input: CreateTransactionInput): Promise<Transaction> => {
  try {
    // Validate that the account exists
    const account = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, input.account_id))
      .execute();

    if (!account || account.length === 0) {
      throw new Error('Account not found');
    }

    const currentAccount = account[0];
    const currentBalance = parseFloat(currentAccount.balance);

    // For withdrawals, check if sufficient balance exists
    if (input.type === 'withdrawal' && currentBalance < input.amount) {
      throw new Error('Insufficient balance');
    }

    // Validate that the processor exists
    const processor = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.processed_by))
      .execute();

    if (!processor || processor.length === 0) {
      throw new Error('Processing user not found');
    }

    // Calculate new balance
    const newBalance = input.type === 'deposit' 
      ? currentBalance + input.amount 
      : currentBalance - input.amount;

    // Start transaction: create transaction record and update account balance
    const result = await db.transaction(async (tx) => {
      // Insert transaction record
      const transactionResult = await tx.insert(transactionsTable)
        .values({
          account_id: input.account_id,
          type: input.type,
          amount: input.amount.toString(), // Convert number to string for numeric column
          description: input.description,
          processed_by: input.processed_by
        })
        .returning()
        .execute();

      // Update account balance
      await tx.update(accountsTable)
        .set({
          balance: newBalance.toString(), // Convert number to string for numeric column
          updated_at: new Date()
        })
        .where(eq(accountsTable.id, input.account_id))
        .execute();

      return transactionResult[0];
    });

    // Convert numeric fields back to numbers before returning
    return {
      ...result,
      amount: parseFloat(result.amount) // Convert string back to number
    };
  } catch (error) {
    console.error('Transaction creation failed:', error);
    throw error;
  }
};