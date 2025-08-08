import { db } from '../db';
import { loansTable, loanInstallmentsTable } from '../db/schema';
import { type ProcessLoanApplicationInput, type Loan } from '../schema';
import { eq } from 'drizzle-orm';

export async function processLoanApplication(input: ProcessLoanApplicationInput): Promise<Loan> {
  try {
    // Fetch the existing loan application
    const existingLoans = await db.select()
      .from(loansTable)
      .where(eq(loansTable.id, input.loan_id))
      .execute();

    if (existingLoans.length === 0) {
      throw new Error(`Loan application with ID ${input.loan_id} not found`);
    }

    const existingLoan = existingLoans[0];

    // Validate loan is in pending status
    if (existingLoan.status !== 'pending') {
      throw new Error(`Loan application is not in pending status. Current status: ${existingLoan.status}`);
    }

    let updateValues: any = {
      status: input.status,
      approved_by: input.approved_by,
      approved_at: input.status === 'approved' ? new Date() : null,
      updated_at: new Date()
    };

    // For approved loans, calculate payment details
    if (input.status === 'approved') {
      if (input.interest_rate === undefined) {
        throw new Error('Interest rate is required for loan approval');
      }

      const principal = parseFloat(existingLoan.amount);
      const annualRate = input.interest_rate / 100; // Convert percentage to decimal
      const monthlyRate = annualRate / 12;
      const termMonths = existingLoan.term_months;

      // Calculate monthly payment using loan formula: P * [r(1+r)^n] / [(1+r)^n - 1]
      let monthlyPayment: number;
      let totalAmount: number;
      
      if (monthlyRate > 0) {
        const factor = Math.pow(1 + monthlyRate, termMonths);
        const exactMonthlyPayment = principal * (monthlyRate * factor) / (factor - 1);
        // Round monthly payment first to 2 decimal places for practical use
        monthlyPayment = Math.round(exactMonthlyPayment * 100) / 100;
        // Calculate total based on the rounded monthly payment (as would happen in practice)
        totalAmount = monthlyPayment * termMonths;
      } else {
        monthlyPayment = Math.round((principal / termMonths) * 100) / 100; // Handle 0% interest rate
        totalAmount = principal;
      }

      updateValues = {
        ...updateValues,
        interest_rate: input.interest_rate.toString(),
        monthly_payment: monthlyPayment.toString(),
        total_amount: totalAmount.toString(),
        remaining_balance: totalAmount.toString(),
        status: 'active' // Approved loans become active
      };
    }

    // Update the loan with new status and calculated values
    const updatedLoans = await db.update(loansTable)
      .set(updateValues)
      .where(eq(loansTable.id, input.loan_id))
      .returning()
      .execute();

    const updatedLoan = updatedLoans[0];

    // For approved loans, create installment schedule
    if (input.status === 'approved') {
      await createInstallmentSchedule(
        input.loan_id,
        parseFloat(updatedLoan.amount),
        input.interest_rate!, // We know it's defined because we validated it above
        updatedLoan.term_months,
        parseFloat(updatedLoan.monthly_payment)
      );
    }

    // Convert numeric fields back to numbers
    return {
      ...updatedLoan,
      amount: parseFloat(updatedLoan.amount),
      interest_rate: parseFloat(updatedLoan.interest_rate),
      monthly_payment: parseFloat(updatedLoan.monthly_payment),
      total_amount: parseFloat(updatedLoan.total_amount),
      remaining_balance: parseFloat(updatedLoan.remaining_balance)
    };
  } catch (error) {
    console.error('Loan application processing failed:', error);
    throw error;
  }
}

async function createInstallmentSchedule(
  loanId: number,
  principal: number,
  annualInterestRate: number,
  termMonths: number,
  monthlyPayment: number
): Promise<void> {
  const monthlyRate = annualInterestRate / 100 / 12;
  let remainingBalance = principal;
  const installments = [];

  for (let i = 1; i <= termMonths; i++) {
    const interestAmount = remainingBalance * monthlyRate;
    const principalAmount = monthlyPayment - interestAmount;
    
    // Adjust last payment to handle rounding differences
    let adjustedMonthlyPayment: number;
    let adjustedPrincipalAmount: number;
    
    if (i === termMonths) {
      // Last payment: pay off remaining balance plus interest
      adjustedPrincipalAmount = remainingBalance;
      adjustedMonthlyPayment = remainingBalance + interestAmount;
    } else {
      adjustedMonthlyPayment = monthlyPayment;
      adjustedPrincipalAmount = principalAmount;
    }

    // Calculate due date (first installment due 1 month from now)
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + i);

    installments.push({
      loan_id: loanId,
      installment_number: i,
      due_date: dueDate,
      amount: adjustedMonthlyPayment.toString(),
      principal_amount: adjustedPrincipalAmount.toString(),
      interest_amount: interestAmount.toString(),
      paid_amount: '0.00',
      paid_at: null,
      recorded_by: null,
      is_paid: false
    });

    remainingBalance -= adjustedPrincipalAmount;
  }

  // Insert all installments
  await db.insert(loanInstallmentsTable)
    .values(installments)
    .execute();
}