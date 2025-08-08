import { db } from '../db';
import { loanInstallmentsTable } from '../db/schema';
import { type LoanInstallment } from '../schema';
import { eq, asc } from 'drizzle-orm';

export const getLoanInstallments = async (loanId: number): Promise<LoanInstallment[]> => {
  try {
    // Query installments for the specific loan, ordered by installment number
    const results = await db.select()
      .from(loanInstallmentsTable)
      .where(eq(loanInstallmentsTable.loan_id, loanId))
      .orderBy(asc(loanInstallmentsTable.installment_number))
      .execute();

    // Convert numeric fields from strings to numbers
    return results.map(installment => ({
      ...installment,
      amount: parseFloat(installment.amount),
      principal_amount: parseFloat(installment.principal_amount),
      interest_amount: parseFloat(installment.interest_amount),
      paid_amount: parseFloat(installment.paid_amount)
    }));
  } catch (error) {
    console.error('Failed to fetch loan installments:', error);
    throw error;
  }
};