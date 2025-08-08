import { db } from '../db';
import { loansTable } from '../db/schema';
import { type Loan } from '../schema';
import { eq } from 'drizzle-orm';

export const getUserLoans = async (userId: number): Promise<Loan[]> => {
  try {
    const results = await db.select()
      .from(loansTable)
      .where(eq(loansTable.user_id, userId))
      .execute();

    // Convert numeric fields back to numbers
    return results.map(loan => ({
      ...loan,
      amount: parseFloat(loan.amount),
      interest_rate: parseFloat(loan.interest_rate),
      monthly_payment: parseFloat(loan.monthly_payment),
      total_amount: parseFloat(loan.total_amount),
      remaining_balance: parseFloat(loan.remaining_balance)
    }));
  } catch (error) {
    console.error('Failed to fetch user loans:', error);
    throw error;
  }
};