import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, loansTable, loanInstallmentsTable } from '../db/schema';
import { getLoanInstallments } from '../handlers/get_loan_installments';

describe('getLoanInstallments', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch all installments for a loan ordered by installment number', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'member'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test loan
    const loanResult = await db.insert(loansTable)
      .values({
        user_id: userId,
        amount: '10000.00',
        interest_rate: '5.00',
        term_months: 3,
        monthly_payment: '3500.00',
        total_amount: '10500.00',
        remaining_balance: '10500.00',
        status: 'active'
      })
      .returning()
      .execute();

    const loanId = loanResult[0].id;

    // Create test installments (out of order to test sorting)
    const installment2 = await db.insert(loanInstallmentsTable)
      .values({
        loan_id: loanId,
        installment_number: 2,
        due_date: new Date('2024-02-15'),
        amount: '3500.00',
        principal_amount: '3400.00',
        interest_amount: '100.00',
        paid_amount: '0.00',
        is_paid: false
      })
      .returning()
      .execute();

    const installment1 = await db.insert(loanInstallmentsTable)
      .values({
        loan_id: loanId,
        installment_number: 1,
        due_date: new Date('2024-01-15'),
        amount: '3500.00',
        principal_amount: '3450.00',
        interest_amount: '50.00',
        paid_amount: '3500.00',
        paid_at: new Date('2024-01-14'),
        is_paid: true
      })
      .returning()
      .execute();

    const installment3 = await db.insert(loanInstallmentsTable)
      .values({
        loan_id: loanId,
        installment_number: 3,
        due_date: new Date('2024-03-15'),
        amount: '3500.00',
        principal_amount: '3150.00',
        interest_amount: '350.00',
        paid_amount: '1000.00',
        is_paid: false
      })
      .returning()
      .execute();

    // Test the handler
    const result = await getLoanInstallments(loanId);

    // Verify results
    expect(result).toHaveLength(3);

    // Verify ordering by installment number
    expect(result[0].installment_number).toBe(1);
    expect(result[1].installment_number).toBe(2);
    expect(result[2].installment_number).toBe(3);

    // Verify numeric field conversions
    expect(typeof result[0].amount).toBe('number');
    expect(typeof result[0].principal_amount).toBe('number');
    expect(typeof result[0].interest_amount).toBe('number');
    expect(typeof result[0].paid_amount).toBe('number');

    // Verify first installment (paid)
    expect(result[0].amount).toBe(3500);
    expect(result[0].principal_amount).toBe(3450);
    expect(result[0].interest_amount).toBe(50);
    expect(result[0].paid_amount).toBe(3500);
    expect(result[0].is_paid).toBe(true);
    expect(result[0].paid_at).toBeInstanceOf(Date);

    // Verify second installment (unpaid)
    expect(result[1].amount).toBe(3500);
    expect(result[1].principal_amount).toBe(3400);
    expect(result[1].interest_amount).toBe(100);
    expect(result[1].paid_amount).toBe(0);
    expect(result[1].is_paid).toBe(false);
    expect(result[1].paid_at).toBeNull();

    // Verify third installment (partially paid)
    expect(result[2].amount).toBe(3500);
    expect(result[2].principal_amount).toBe(3150);
    expect(result[2].interest_amount).toBe(350);
    expect(result[2].paid_amount).toBe(1000);
    expect(result[2].is_paid).toBe(false);
    expect(result[2].paid_at).toBeNull();
  });

  it('should return empty array for non-existent loan', async () => {
    const result = await getLoanInstallments(999);
    expect(result).toHaveLength(0);
  });

  it('should return empty array for loan with no installments', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser2',
        email: 'test2@example.com',
        full_name: 'Test User 2',
        role: 'member'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create loan without installments
    const loanResult = await db.insert(loansTable)
      .values({
        user_id: userId,
        amount: '5000.00',
        interest_rate: '4.50',
        term_months: 12,
        monthly_payment: '450.00',
        total_amount: '5400.00',
        remaining_balance: '5400.00',
        status: 'pending'
      })
      .returning()
      .execute();

    const loanId = loanResult[0].id;

    const result = await getLoanInstallments(loanId);
    expect(result).toHaveLength(0);
  });

  it('should handle installments with different payment statuses', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser3',
        email: 'test3@example.com',
        full_name: 'Test User 3',
        role: 'member'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test loan
    const loanResult = await db.insert(loansTable)
      .values({
        user_id: userId,
        amount: '8000.00',
        interest_rate: '6.00',
        term_months: 2,
        monthly_payment: '4200.00',
        total_amount: '8400.00',
        remaining_balance: '4200.00',
        status: 'active'
      })
      .returning()
      .execute();

    const loanId = loanResult[0].id;

    // Create installments with different payment statuses
    await db.insert(loanInstallmentsTable)
      .values([
        {
          loan_id: loanId,
          installment_number: 1,
          due_date: new Date('2024-01-15'),
          amount: '4200.00',
          principal_amount: '4000.00',
          interest_amount: '200.00',
          paid_amount: '4200.00',
          paid_at: new Date('2024-01-10'),
          is_paid: true
        },
        {
          loan_id: loanId,
          installment_number: 2,
          due_date: new Date('2024-02-15'),
          amount: '4200.00',
          principal_amount: '4000.00',
          interest_amount: '200.00',
          paid_amount: '0.00',
          is_paid: false
        }
      ])
      .execute();

    const result = await getLoanInstallments(loanId);

    expect(result).toHaveLength(2);
    
    // First installment should be marked as paid
    expect(result[0].is_paid).toBe(true);
    expect(result[0].paid_amount).toBe(4200);
    expect(result[0].paid_at).toBeInstanceOf(Date);
    
    // Second installment should be unpaid
    expect(result[1].is_paid).toBe(false);
    expect(result[1].paid_amount).toBe(0);
    expect(result[1].paid_at).toBeNull();
  });

  it('should handle installments with recorded_by user', async () => {
    // Create test users
    const userResult = await db.insert(usersTable)
      .values([
        {
          username: 'borrower',
          email: 'borrower@example.com',
          full_name: 'Borrower User',
          role: 'member'
        },
        {
          username: 'recorder',
          email: 'recorder@example.com',
          full_name: 'Recorder User',
          role: 'cooperative_management'
        }
      ])
      .returning()
      .execute();

    const borrowerId = userResult[0].id;
    const recorderId = userResult[1].id;

    // Create test loan
    const loanResult = await db.insert(loansTable)
      .values({
        user_id: borrowerId,
        amount: '3000.00',
        interest_rate: '7.00',
        term_months: 1,
        monthly_payment: '3100.00',
        total_amount: '3100.00',
        remaining_balance: '0.00',
        status: 'completed'
      })
      .returning()
      .execute();

    const loanId = loanResult[0].id;

    // Create installment with recorded_by
    await db.insert(loanInstallmentsTable)
      .values({
        loan_id: loanId,
        installment_number: 1,
        due_date: new Date('2024-01-15'),
        amount: '3100.00',
        principal_amount: '3000.00',
        interest_amount: '100.00',
        paid_amount: '3100.00',
        paid_at: new Date('2024-01-14'),
        recorded_by: recorderId,
        is_paid: true
      })
      .execute();

    const result = await getLoanInstallments(loanId);

    expect(result).toHaveLength(1);
    expect(result[0].recorded_by).toBe(recorderId);
    expect(result[0].is_paid).toBe(true);
    expect(result[0].paid_amount).toBe(3100);
  });
});