import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, loansTable, loanInstallmentsTable } from '../db/schema';
import { type ProcessLoanApplicationInput } from '../schema';
import { processLoanApplication } from '../handlers/process_loan_application';
import { eq } from 'drizzle-orm';

describe('processLoanApplication', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let approverId: number;
  let loanId: number;

  beforeEach(async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'testuser',
          email: 'test@example.com',
          full_name: 'Test User',
          phone: '123-456-7890',
          address: '123 Test St',
          role: 'member',
          is_active: true
        },
        {
          username: 'approver',
          email: 'approver@example.com',
          full_name: 'Loan Approver',
          phone: '098-765-4321',
          address: '456 Admin Ave',
          role: 'cooperative_management',
          is_active: true
        }
      ])
      .returning()
      .execute();

    testUserId = users[0].id;
    approverId = users[1].id;

    // Create a pending loan application
    const loans = await db.insert(loansTable)
      .values({
        user_id: testUserId,
        amount: '10000.00',
        interest_rate: '0.00', // Will be set during approval
        term_months: 12,
        monthly_payment: '0.00', // Will be calculated during approval
        total_amount: '0.00', // Will be calculated during approval
        remaining_balance: '0.00', // Will be set during approval
        status: 'pending',
        purpose: 'Business expansion',
        approved_by: null,
        approved_at: null,
        disbursed_at: null
      })
      .returning()
      .execute();

    loanId = loans[0].id;
  });

  it('should approve a loan application and calculate payment details', async () => {
    const input: ProcessLoanApplicationInput = {
      loan_id: loanId,
      status: 'approved',
      approved_by: approverId,
      interest_rate: 12.0 // 12% annual interest
    };

    const result = await processLoanApplication(input);

    expect(result.id).toBe(loanId);
    expect(result.status).toBe('active');
    expect(result.approved_by).toBe(approverId);
    expect(result.approved_at).toBeInstanceOf(Date);
    expect(result.interest_rate).toBe(12.0);
    
    // Verify monthly payment calculation (approximate due to rounding)
    expect(result.monthly_payment).toBeCloseTo(888.49, 2);
    expect(result.total_amount).toBeCloseTo(10661.88, 2);
    expect(result.remaining_balance).toBeCloseTo(10661.88, 2);

    // Verify numeric field types
    expect(typeof result.amount).toBe('number');
    expect(typeof result.interest_rate).toBe('number');
    expect(typeof result.monthly_payment).toBe('number');
    expect(typeof result.total_amount).toBe('number');
    expect(typeof result.remaining_balance).toBe('number');
  });

  it('should reject a loan application', async () => {
    const input: ProcessLoanApplicationInput = {
      loan_id: loanId,
      status: 'rejected',
      approved_by: approverId
    };

    const result = await processLoanApplication(input);

    expect(result.id).toBe(loanId);
    expect(result.status).toBe('rejected');
    expect(result.approved_by).toBe(approverId);
    expect(result.approved_at).toBeNull();
    
    // Original loan values should remain unchanged for rejected loans
    expect(result.monthly_payment).toBe(0);
    expect(result.total_amount).toBe(0);
  });

  it('should create installment schedule for approved loans', async () => {
    const input: ProcessLoanApplicationInput = {
      loan_id: loanId,
      status: 'approved',
      approved_by: approverId,
      interest_rate: 12.0
    };

    await processLoanApplication(input);

    // Check that installments were created
    const installments = await db.select()
      .from(loanInstallmentsTable)
      .where(eq(loanInstallmentsTable.loan_id, loanId))
      .execute();

    expect(installments).toHaveLength(12);

    // Check first installment
    const firstInstallment = installments[0];
    expect(firstInstallment.installment_number).toBe(1);
    expect(firstInstallment.is_paid).toBe(false);
    expect(parseFloat(firstInstallment.paid_amount)).toBe(0);
    expect(firstInstallment.due_date).toBeInstanceOf(Date);
    
    // Verify installment amounts are calculated correctly
    expect(parseFloat(firstInstallment.amount)).toBeCloseTo(888.49, 2);
    expect(parseFloat(firstInstallment.interest_amount)).toBeCloseTo(100, 2); // 10000 * 0.01 monthly rate
    expect(parseFloat(firstInstallment.principal_amount)).toBeCloseTo(788.49, 2);

    // Check last installment (should handle rounding)
    const lastInstallment = installments[installments.length - 1];
    expect(lastInstallment.installment_number).toBe(12);
  });

  it('should handle zero interest rate loans', async () => {
    const input: ProcessLoanApplicationInput = {
      loan_id: loanId,
      status: 'approved',
      approved_by: approverId,
      interest_rate: 0.0
    };

    const result = await processLoanApplication(input);

    expect(result.interest_rate).toBe(0);
    expect(result.monthly_payment).toBeCloseTo(833.33, 2); // 10000 / 12
    expect(result.total_amount).toBe(10000);
    expect(result.remaining_balance).toBe(10000);

    // Verify installments for zero interest
    const installments = await db.select()
      .from(loanInstallmentsTable)
      .where(eq(loanInstallmentsTable.loan_id, loanId))
      .execute();

    expect(installments).toHaveLength(12);
    
    const firstInstallment = installments[0];
    expect(parseFloat(firstInstallment.interest_amount)).toBe(0);
    expect(parseFloat(firstInstallment.principal_amount)).toBeCloseTo(833.33, 2);
  });

  it('should throw error for non-existent loan', async () => {
    const input: ProcessLoanApplicationInput = {
      loan_id: 99999,
      status: 'approved',
      approved_by: approverId,
      interest_rate: 12.0
    };

    await expect(processLoanApplication(input)).rejects.toThrow(/not found/i);
  });

  it('should throw error for non-pending loan', async () => {
    // Update loan to approved status first
    await db.update(loansTable)
      .set({ status: 'approved' })
      .where(eq(loansTable.id, loanId))
      .execute();

    const input: ProcessLoanApplicationInput = {
      loan_id: loanId,
      status: 'approved',
      approved_by: approverId,
      interest_rate: 12.0
    };

    await expect(processLoanApplication(input)).rejects.toThrow(/not in pending status/i);
  });

  it('should throw error when approving without interest rate', async () => {
    const input: ProcessLoanApplicationInput = {
      loan_id: loanId,
      status: 'approved',
      approved_by: approverId
      // Missing interest_rate
    };

    await expect(processLoanApplication(input)).rejects.toThrow(/interest rate is required/i);
  });

  it('should save updated loan to database', async () => {
    const input: ProcessLoanApplicationInput = {
      loan_id: loanId,
      status: 'approved',
      approved_by: approverId,
      interest_rate: 15.0
    };

    await processLoanApplication(input);

    // Verify loan was updated in database
    const loans = await db.select()
      .from(loansTable)
      .where(eq(loansTable.id, loanId))
      .execute();

    expect(loans).toHaveLength(1);
    const loan = loans[0];
    expect(loan.status).toBe('active');
    expect(loan.approved_by).toBe(approverId);
    expect(loan.approved_at).toBeInstanceOf(Date);
    expect(parseFloat(loan.interest_rate)).toBe(15.0);
    expect(parseFloat(loan.monthly_payment)).toBeGreaterThan(0);
  });

  it('should not create installments for rejected loans', async () => {
    const input: ProcessLoanApplicationInput = {
      loan_id: loanId,
      status: 'rejected',
      approved_by: approverId
    };

    await processLoanApplication(input);

    // Check that no installments were created
    const installments = await db.select()
      .from(loanInstallmentsTable)
      .where(eq(loanInstallmentsTable.loan_id, loanId))
      .execute();

    expect(installments).toHaveLength(0);
  });
});