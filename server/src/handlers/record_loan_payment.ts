import { db } from '../db';
import { loanInstallmentsTable, loansTable } from '../db/schema';
import { type RecordLoanPaymentInput, type LoanInstallment } from '../schema';
import { eq } from 'drizzle-orm';

export const recordLoanPayment = async (input: RecordLoanPaymentInput): Promise<LoanInstallment> => {
  try {
    // First, get the installment to verify it exists and get current state
    const installments = await db.select()
      .from(loanInstallmentsTable)
      .where(eq(loanInstallmentsTable.id, input.installment_id))
      .execute();

    if (installments.length === 0) {
      throw new Error(`Loan installment with ID ${input.installment_id} not found`);
    }

    const installment = installments[0];
    
    // Calculate new paid amount (existing + new payment)
    const currentPaidAmount = parseFloat(installment.paid_amount);
    const newPaidAmount = currentPaidAmount + input.paid_amount;
    const installmentAmount = parseFloat(installment.amount);
    
    // Check if payment would exceed installment amount
    if (newPaidAmount > installmentAmount) {
      throw new Error(`Payment amount ${input.paid_amount} would exceed remaining balance of ${installmentAmount - currentPaidAmount}`);
    }

    // Determine if installment is now fully paid
    const isPaid = newPaidAmount >= installmentAmount;
    const paidAt = isPaid && !installment.paid_at ? new Date() : installment.paid_at;

    // Update the installment
    const updatedInstallments = await db.update(loanInstallmentsTable)
      .set({
        paid_amount: newPaidAmount.toString(),
        is_paid: isPaid,
        paid_at: paidAt,
        recorded_by: input.recorded_by
      })
      .where(eq(loanInstallmentsTable.id, input.installment_id))
      .returning()
      .execute();

    const updatedInstallment = updatedInstallments[0];

    // Update loan remaining balance
    const loans = await db.select()
      .from(loansTable)
      .where(eq(loansTable.id, installment.loan_id))
      .execute();

    if (loans.length > 0) {
      const loan = loans[0];
      const currentRemainingBalance = parseFloat(loan.remaining_balance);
      const newRemainingBalance = currentRemainingBalance - input.paid_amount;

      await db.update(loansTable)
        .set({
          remaining_balance: Math.max(0, newRemainingBalance).toString()
        })
        .where(eq(loansTable.id, installment.loan_id))
        .execute();
    }

    // Convert numeric fields back to numbers before returning
    return {
      ...updatedInstallment,
      amount: parseFloat(updatedInstallment.amount),
      principal_amount: parseFloat(updatedInstallment.principal_amount),
      interest_amount: parseFloat(updatedInstallment.interest_amount),
      paid_amount: parseFloat(updatedInstallment.paid_amount)
    };
  } catch (error) {
    console.error('Loan payment recording failed:', error);
    throw error;
  }
};