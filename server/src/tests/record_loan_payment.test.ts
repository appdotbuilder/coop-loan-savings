import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, loansTable, loanInstallmentsTable } from '../db/schema';
import { type RecordLoanPaymentInput } from '../schema';
import { recordLoanPayment } from '../handlers/record_loan_payment';
import { eq } from 'drizzle-orm';

describe('recordLoanPayment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testLoanId: number;
  let testInstallmentId: number;
  let testProcessorId: number;

  beforeEach(async () => {
    // Create test user (borrower)
    const users = await db.insert(usersTable)
      .values({
        username: 'testborrower',
        email: 'borrower@test.com',
        full_name: 'Test Borrower',
        phone: '1234567890',
        address: '123 Test St',
        role: 'member'
      })
      .returning()
      .execute();
    testUserId = users[0].id;

    // Create test user (processor)
    const processors = await db.insert(usersTable)
      .values({
        username: 'testprocessor',
        email: 'processor@test.com',
        full_name: 'Test Processor',
        phone: '0987654321',
        address: '456 Admin Ave',
        role: 'cooperative_management'
      })
      .returning()
      .execute();
    testProcessorId = processors[0].id;

    // Create test loan
    const loans = await db.insert(loansTable)
      .values({
        user_id: testUserId,
        amount: '1000.00',
        interest_rate: '10.00',
        term_months: 12,
        monthly_payment: '87.92',
        total_amount: '1055.04',
        remaining_balance: '1000.00',
        status: 'active'
      })
      .returning()
      .execute();
    testLoanId = loans[0].id;

    // Create test installment
    const installments = await db.insert(loanInstallmentsTable)
      .values({
        loan_id: testLoanId,
        installment_number: 1,
        due_date: new Date('2024-02-01'),
        amount: '87.92',
        principal_amount: '75.59',
        interest_amount: '12.33',
        paid_amount: '0.00',
        is_paid: false
      })
      .returning()
      .execute();
    testInstallmentId = installments[0].id;
  });

  const testInput: RecordLoanPaymentInput = {
    installment_id: 0, // Will be set in tests
    paid_amount: 50.00,
    recorded_by: 0 // Will be set in tests
  };

  it('should record partial payment for installment', async () => {
    const input = {
      ...testInput,
      installment_id: testInstallmentId,
      recorded_by: testProcessorId
    };

    const result = await recordLoanPayment(input);

    expect(result.id).toEqual(testInstallmentId);
    expect(result.paid_amount).toEqual(50.00);
    expect(typeof result.paid_amount).toBe('number');
    expect(result.is_paid).toBe(false); // Partial payment
    expect(result.recorded_by).toEqual(testProcessorId);
    expect(result.paid_at).toBeNull(); // Not fully paid yet
  });

  it('should record full payment and mark installment as paid', async () => {
    const input = {
      ...testInput,
      installment_id: testInstallmentId,
      paid_amount: 87.92,
      recorded_by: testProcessorId
    };

    const result = await recordLoanPayment(input);

    expect(result.paid_amount).toEqual(87.92);
    expect(result.is_paid).toBe(true);
    expect(result.paid_at).toBeInstanceOf(Date);
    expect(result.recorded_by).toEqual(testProcessorId);
  });

  it('should accumulate multiple payments', async () => {
    // First payment
    const firstPayment = {
      installment_id: testInstallmentId,
      paid_amount: 40.00,
      recorded_by: testProcessorId
    };

    const firstResult = await recordLoanPayment(firstPayment);
    expect(firstResult.paid_amount).toEqual(40.00);
    expect(firstResult.is_paid).toBe(false);

    // Second payment to complete
    const secondPayment = {
      installment_id: testInstallmentId,
      paid_amount: 47.92,
      recorded_by: testProcessorId
    };

    const secondResult = await recordLoanPayment(secondPayment);
    expect(secondResult.paid_amount).toEqual(87.92);
    expect(secondResult.is_paid).toBe(true);
    expect(secondResult.paid_at).toBeInstanceOf(Date);
  });

  it('should update loan remaining balance', async () => {
    const input = {
      installment_id: testInstallmentId,
      paid_amount: 50.00,
      recorded_by: testProcessorId
    };

    await recordLoanPayment(input);

    // Check that loan balance was reduced
    const loans = await db.select()
      .from(loansTable)
      .where(eq(loansTable.id, testLoanId))
      .execute();

    expect(loans).toHaveLength(1);
    expect(parseFloat(loans[0].remaining_balance)).toEqual(950.00);
  });

  it('should save payment record to database', async () => {
    const input = {
      installment_id: testInstallmentId,
      paid_amount: 75.50,
      recorded_by: testProcessorId
    };

    await recordLoanPayment(input);

    // Verify database record
    const installments = await db.select()
      .from(loanInstallmentsTable)
      .where(eq(loanInstallmentsTable.id, testInstallmentId))
      .execute();

    expect(installments).toHaveLength(1);
    const installment = installments[0];
    expect(parseFloat(installment.paid_amount)).toEqual(75.50);
    expect(installment.is_paid).toBe(false);
    expect(installment.recorded_by).toEqual(testProcessorId);
    expect(installment.paid_at).toBeNull();
  });

  it('should throw error for non-existent installment', async () => {
    const input = {
      installment_id: 99999,
      paid_amount: 50.00,
      recorded_by: testProcessorId
    };

    await expect(recordLoanPayment(input)).rejects.toThrow(/not found/i);
  });

  it('should throw error for overpayment', async () => {
    const input = {
      installment_id: testInstallmentId,
      paid_amount: 100.00, // More than installment amount of 87.92
      recorded_by: testProcessorId
    };

    await expect(recordLoanPayment(input)).rejects.toThrow(/exceed remaining balance/i);
  });

  it('should handle exact payment amount correctly', async () => {
    const input = {
      installment_id: testInstallmentId,
      paid_amount: 87.92, // Exact installment amount
      recorded_by: testProcessorId
    };

    const result = await recordLoanPayment(input);

    expect(result.paid_amount).toEqual(87.92);
    expect(result.is_paid).toBe(true);
    expect(result.paid_at).toBeInstanceOf(Date);
  });

  it('should not allow overpayment after partial payment', async () => {
    // First make partial payment
    await recordLoanPayment({
      installment_id: testInstallmentId,
      paid_amount: 50.00,
      recorded_by: testProcessorId
    });

    // Try to pay more than remaining balance
    const overpaymentInput = {
      installment_id: testInstallmentId,
      paid_amount: 50.00, // Would total 100.00, exceeding 87.92
      recorded_by: testProcessorId
    };

    await expect(recordLoanPayment(overpaymentInput)).rejects.toThrow(/exceed remaining balance/i);
  });

  it('should convert all numeric fields correctly', async () => {
    const input = {
      installment_id: testInstallmentId,
      paid_amount: 25.75,
      recorded_by: testProcessorId
    };

    const result = await recordLoanPayment(input);

    // Verify all numeric fields are numbers, not strings
    expect(typeof result.amount).toBe('number');
    expect(typeof result.principal_amount).toBe('number');
    expect(typeof result.interest_amount).toBe('number');
    expect(typeof result.paid_amount).toBe('number');
    
    expect(result.amount).toEqual(87.92);
    expect(result.principal_amount).toEqual(75.59);
    expect(result.interest_amount).toEqual(12.33);
    expect(result.paid_amount).toEqual(25.75);
  });
});