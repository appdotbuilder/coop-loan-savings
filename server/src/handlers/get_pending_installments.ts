import { db } from '../db';
import { loanInstallmentsTable, loansTable, usersTable } from '../db/schema';
import { type LoanInstallment } from '../schema';
import { eq, and } from 'drizzle-orm';

export const getPendingInstallments = async (): Promise<LoanInstallment[]> => {
  try {
    // Query for unpaid installments with loan and borrower information
    const results = await db.select({
      id: loanInstallmentsTable.id,
      loan_id: loanInstallmentsTable.loan_id,
      installment_number: loanInstallmentsTable.installment_number,
      due_date: loanInstallmentsTable.due_date,
      amount: loanInstallmentsTable.amount,
      principal_amount: loanInstallmentsTable.principal_amount,
      interest_amount: loanInstallmentsTable.interest_amount,
      paid_amount: loanInstallmentsTable.paid_amount,
      paid_at: loanInstallmentsTable.paid_at,
      recorded_by: loanInstallmentsTable.recorded_by,
      is_paid: loanInstallmentsTable.is_paid,
      created_at: loanInstallmentsTable.created_at
    })
    .from(loanInstallmentsTable)
    .innerJoin(loansTable, eq(loanInstallmentsTable.loan_id, loansTable.id))
    .innerJoin(usersTable, eq(loansTable.user_id, usersTable.id))
    .where(
      and(
        eq(loanInstallmentsTable.is_paid, false),
        eq(loansTable.status, 'active')
      )
    )
    .execute();

    // Convert numeric fields back to numbers
    return results.map(installment => ({
      ...installment,
      amount: parseFloat(installment.amount),
      principal_amount: parseFloat(installment.principal_amount),
      interest_amount: parseFloat(installment.interest_amount),
      paid_amount: parseFloat(installment.paid_amount)
    }));
  } catch (error) {
    console.error('Failed to fetch pending installments:', error);
    throw error;
  }
};