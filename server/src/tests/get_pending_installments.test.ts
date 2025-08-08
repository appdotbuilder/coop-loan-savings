import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, accountsTable, loansTable, loanInstallmentsTable } from '../db/schema';
import { getPendingInstallments } from '../handlers/get_pending_installments';

describe('getPendingInstallments', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no pending installments exist', async () => {
    const result = await getPendingInstallments();
    expect(result).toEqual([]);
  });

  it('should return pending installments for active loans', async () => {
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

    // Create test account
    await db.insert(accountsTable)
      .values({
        user_id: userId,
        account_number: 'ACC001',
        balance: '1000.00'
      })
      .execute();

    // Create active loan
    const loanResult = await db.insert(loansTable)
      .values({
        user_id: userId,
        amount: '10000.00',
        interest_rate: '12.00',
        term_months: 12,
        monthly_payment: '888.49',
        total_amount: '10661.88',
        remaining_balance: '10000.00',
        status: 'active'
      })
      .returning()
      .execute();
    const loanId = loanResult[0].id;

    // Create pending installments
    await db.insert(loanInstallmentsTable)
      .values([
        {
          loan_id: loanId,
          installment_number: 1,
          due_date: new Date('2024-01-15'),
          amount: '888.49',
          principal_amount: '788.49',
          interest_amount: '100.00',
          is_paid: false
        },
        {
          loan_id: loanId,
          installment_number: 2,
          due_date: new Date('2024-02-15'),
          amount: '888.49',
          principal_amount: '795.97',
          interest_amount: '92.52',
          is_paid: false
        }
      ])
      .execute();

    const result = await getPendingInstallments();

    expect(result).toHaveLength(2);
    
    // Verify first installment
    const firstInstallment = result.find(i => i.installment_number === 1);
    expect(firstInstallment).toBeDefined();
    expect(firstInstallment!.loan_id).toBe(loanId);
    expect(firstInstallment!.amount).toBe(888.49);
    expect(firstInstallment!.principal_amount).toBe(788.49);
    expect(firstInstallment!.interest_amount).toBe(100.00);
    expect(firstInstallment!.paid_amount).toBe(0.00);
    expect(firstInstallment!.is_paid).toBe(false);
    expect(firstInstallment!.due_date).toBeInstanceOf(Date);
    expect(firstInstallment!.created_at).toBeInstanceOf(Date);

    // Verify numeric type conversions
    expect(typeof firstInstallment!.amount).toBe('number');
    expect(typeof firstInstallment!.principal_amount).toBe('number');
    expect(typeof firstInstallment!.interest_amount).toBe('number');
    expect(typeof firstInstallment!.paid_amount).toBe('number');
  });

  it('should exclude paid installments', async () => {
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

    // Create test account
    await db.insert(accountsTable)
      .values({
        user_id: userId,
        account_number: 'ACC001',
        balance: '1000.00'
      })
      .execute();

    // Create active loan
    const loanResult = await db.insert(loansTable)
      .values({
        user_id: userId,
        amount: '5000.00',
        interest_rate: '10.00',
        term_months: 6,
        monthly_payment: '872.56',
        total_amount: '5235.36',
        remaining_balance: '3490.24',
        status: 'active'
      })
      .returning()
      .execute();
    const loanId = loanResult[0].id;

    // Create mix of paid and unpaid installments
    await db.insert(loanInstallmentsTable)
      .values([
        {
          loan_id: loanId,
          installment_number: 1,
          due_date: new Date('2024-01-15'),
          amount: '872.56',
          principal_amount: '830.89',
          interest_amount: '41.67',
          paid_amount: '872.56',
          is_paid: true,
          paid_at: new Date('2024-01-15'),
          recorded_by: userId
        },
        {
          loan_id: loanId,
          installment_number: 2,
          due_date: new Date('2024-02-15'),
          amount: '872.56',
          principal_amount: '837.82',
          interest_amount: '34.74',
          is_paid: false
        },
        {
          loan_id: loanId,
          installment_number: 3,
          due_date: new Date('2024-03-15'),
          amount: '872.56',
          principal_amount: '844.81',
          interest_amount: '27.75',
          is_paid: false
        }
      ])
      .execute();

    const result = await getPendingInstallments();

    // Should only return unpaid installments
    expect(result).toHaveLength(2);
    expect(result.every(i => !i.is_paid)).toBe(true);
    expect(result.some(i => i.installment_number === 1)).toBe(false);
    expect(result.some(i => i.installment_number === 2)).toBe(true);
    expect(result.some(i => i.installment_number === 3)).toBe(true);
  });

  it('should exclude installments from non-active loans', async () => {
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

    // Create test account
    await db.insert(accountsTable)
      .values({
        user_id: userId,
        account_number: 'ACC001',
        balance: '1000.00'
      })
      .execute();

    // Create loans with different statuses
    const loanResults = await db.insert(loansTable)
      .values([
        {
          user_id: userId,
          amount: '3000.00',
          interest_rate: '8.00',
          term_months: 12,
          monthly_payment: '260.93',
          total_amount: '3131.16',
          remaining_balance: '3000.00',
          status: 'pending'
        },
        {
          user_id: userId,
          amount: '5000.00',
          interest_rate: '10.00',
          term_months: 6,
          monthly_payment: '872.56',
          total_amount: '5235.36',
          remaining_balance: '0.00',
          status: 'completed'
        },
        {
          user_id: userId,
          amount: '7000.00',
          interest_rate: '12.00',
          term_months: 24,
          monthly_payment: '329.53',
          total_amount: '7908.72',
          remaining_balance: '7000.00',
          status: 'active'
        }
      ])
      .returning()
      .execute();

    const pendingLoanId = loanResults[0].id;
    const completedLoanId = loanResults[1].id;
    const activeLoanId = loanResults[2].id;

    // Create installments for all loans
    await db.insert(loanInstallmentsTable)
      .values([
        {
          loan_id: pendingLoanId,
          installment_number: 1,
          due_date: new Date('2024-02-15'),
          amount: '260.93',
          principal_amount: '240.93',
          interest_amount: '20.00',
          is_paid: false
        },
        {
          loan_id: completedLoanId,
          installment_number: 1,
          due_date: new Date('2024-01-15'),
          amount: '872.56',
          principal_amount: '830.89',
          interest_amount: '41.67',
          is_paid: false
        },
        {
          loan_id: activeLoanId,
          installment_number: 1,
          due_date: new Date('2024-03-15'),
          amount: '329.53',
          principal_amount: '306.20',
          interest_amount: '23.33',
          is_paid: false
        }
      ])
      .execute();

    const result = await getPendingInstallments();

    // Should only return installments from active loans
    expect(result).toHaveLength(1);
    expect(result[0].loan_id).toBe(activeLoanId);
    expect(result[0].amount).toBe(329.53);
  });

  it('should handle loans with partial payments correctly', async () => {
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

    // Create test account
    await db.insert(accountsTable)
      .values({
        user_id: userId,
        account_number: 'ACC001',
        balance: '1000.00'
      })
      .execute();

    // Create active loan
    const loanResult = await db.insert(loansTable)
      .values({
        user_id: userId,
        amount: '2000.00',
        interest_rate: '15.00',
        term_months: 4,
        monthly_payment: '544.48',
        total_amount: '2177.92',
        remaining_balance: '1500.00',
        status: 'active'
      })
      .returning()
      .execute();
    const loanId = loanResult[0].id;

    // Create installment with partial payment
    await db.insert(loanInstallmentsTable)
      .values({
        loan_id: loanId,
        installment_number: 1,
        due_date: new Date('2024-01-15'),
        amount: '544.48',
        principal_amount: '519.48',
        interest_amount: '25.00',
        paid_amount: '300.00', // Partial payment
        is_paid: false
      })
      .execute();

    const result = await getPendingInstallments();

    expect(result).toHaveLength(1);
    expect(result[0].loan_id).toBe(loanId);
    expect(result[0].amount).toBe(544.48);
    expect(result[0].paid_amount).toBe(300.00);
    expect(result[0].is_paid).toBe(false);
    
    // Verify remaining balance calculation can be done
    const remainingAmount = result[0].amount - result[0].paid_amount;
    expect(remainingAmount).toBeCloseTo(244.48, 2);
  });
});