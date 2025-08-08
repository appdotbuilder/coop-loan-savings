import { db } from '../db';
import { loansTable, usersTable } from '../db/schema';
import { type CreateLoanApplicationInput, type Loan } from '../schema';
import { eq } from 'drizzle-orm';

export const applyForLoan = async (input: CreateLoanApplicationInput): Promise<Loan> => {
  try {
    // First, verify the user exists
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (users.length === 0) {
      throw new Error(`User with ID ${input.user_id} not found`);
    }

    // Create the loan application with pending status
    // Interest rate, monthly payment, and total amount will be calculated during approval
    const result = await db.insert(loansTable)
      .values({
        user_id: input.user_id,
        amount: input.amount.toString(),
        interest_rate: '0', // Will be set during approval process
        term_months: input.term_months,
        monthly_payment: '0', // Will be calculated during approval
        total_amount: '0', // Will be calculated during approval  
        remaining_balance: '0', // Will be set when loan is disbursed
        status: 'pending',
        purpose: input.purpose
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const loan = result[0];
    return {
      ...loan,
      amount: parseFloat(loan.amount),
      interest_rate: parseFloat(loan.interest_rate),
      monthly_payment: parseFloat(loan.monthly_payment),
      total_amount: parseFloat(loan.total_amount),
      remaining_balance: parseFloat(loan.remaining_balance)
    };
  } catch (error) {
    console.error('Loan application failed:', error);
    throw error;
  }
};