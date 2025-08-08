import { db } from '../db';
import { loansTable } from '../db/schema';
import { type Loan } from '../schema';

export async function getLoanApplications(): Promise<Loan[]> {
  try {
    const results = await db.select()
      .from(loansTable)
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
    console.error('Failed to fetch loan applications:', error);
    throw error;
  }
}