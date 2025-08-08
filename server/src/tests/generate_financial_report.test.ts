import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  accountsTable, 
  transactionsTable, 
  loansTable, 
  loanInstallmentsTable 
} from '../db/schema';
import { type FinancialReportInput } from '../schema';
import { generateFinancialReport } from '../handlers/generate_financial_report';

describe('generateFinancialReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate empty report for date range with no data', async () => {
    const input: FinancialReportInput = {
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31')
    };

    const result = await generateFinancialReport(input);

    expect(result.period.start_date).toEqual(input.start_date);
    expect(result.period.end_date).toEqual(input.end_date);
    expect(result.savings.total_deposits).toBe(0);
    expect(result.savings.total_withdrawals).toBe(0);
    expect(result.savings.net_savings).toBe(0);
    expect(result.savings.total_balance).toBe(0);
    expect(result.loans.total_disbursed).toBe(0);
    expect(result.loans.total_repaid).toBe(0);
    expect(result.loans.outstanding_principal).toBe(0);
    expect(result.loans.interest_earned).toBe(0);
    expect(result.loans.active_loans).toBe(0);
    expect(result.loans.completed_loans).toBe(0);
    expect(result.installments.total_expected).toBe(0);
    expect(result.installments.total_collected).toBe(0);
    expect(result.installments.overdue_amount).toBe(0);
    expect(result.installments.collection_rate).toBe(0);
  });

  it('should calculate savings statistics correctly', async () => {
    // Create test users
    const users = await db.insert(usersTable).values([
      {
        username: 'testuser1',
        email: 'test1@example.com',
        full_name: 'Test User 1',
        role: 'member'
      },
      {
        username: 'admin1',
        email: 'admin1@example.com',
        full_name: 'Admin User',
        role: 'admin'
      }
    ]).returning().execute();

    // Create test accounts
    const accounts = await db.insert(accountsTable).values([
      {
        user_id: users[0].id,
        account_number: 'ACC001',
        balance: '1500.00'
      },
      {
        user_id: users[1].id,
        account_number: 'ACC002',
        balance: '2500.00'
      }
    ]).returning().execute();

    // Create transactions within date range
    const testDate = new Date('2024-01-15T10:00:00Z');
    await db.insert(transactionsTable).values([
      {
        account_id: accounts[0].id,
        type: 'deposit',
        amount: '500.00',
        description: 'Test deposit',
        processed_by: users[1].id,
        created_at: testDate
      },
      {
        account_id: accounts[0].id,
        type: 'deposit',
        amount: '300.00',
        description: 'Another deposit',
        processed_by: users[1].id,
        created_at: testDate
      },
      {
        account_id: accounts[1].id,
        type: 'withdrawal',
        amount: '200.00',
        description: 'Test withdrawal',
        processed_by: users[1].id,
        created_at: testDate
      }
    ]).execute();

    const input: FinancialReportInput = {
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31')
    };

    const result = await generateFinancialReport(input);

    expect(result.savings.total_deposits).toBe(800); // 500 + 300
    expect(result.savings.total_withdrawals).toBe(200);
    expect(result.savings.net_savings).toBe(600); // 800 - 200
    expect(result.savings.total_balance).toBe(4000); // 1500 + 2500
  });

  it('should calculate loan statistics correctly', async () => {
    // Create test users
    const users = await db.insert(usersTable).values([
      {
        username: 'borrower1',
        email: 'borrower1@example.com',
        full_name: 'Borrower 1',
        role: 'member'
      },
      {
        username: 'admin1',
        email: 'admin1@example.com',
        full_name: 'Admin User',
        role: 'admin'
      }
    ]).returning().execute();

    // Create test loans
    const disbursedDate = new Date('2024-01-10T10:00:00Z');
    const loans = await db.insert(loansTable).values([
      {
        user_id: users[0].id,
        amount: '10000.00',
        interest_rate: '12.00',
        term_months: 12,
        monthly_payment: '888.49',
        total_amount: '10661.88',
        remaining_balance: '8000.00',
        status: 'active',
        purpose: 'Business loan',
        approved_by: users[1].id,
        approved_at: new Date('2024-01-05T10:00:00Z'),
        disbursed_at: disbursedDate
      },
      {
        user_id: users[0].id,
        amount: '5000.00',
        interest_rate: '10.00',
        term_months: 6,
        monthly_payment: '855.72',
        total_amount: '5334.32',
        remaining_balance: '0.00',
        status: 'completed',
        purpose: 'Personal loan',
        approved_by: users[1].id,
        approved_at: new Date('2023-12-01T10:00:00Z'),
        disbursed_at: new Date('2023-12-05T10:00:00Z')
      }
    ]).returning().execute();

    // Create installments and payments
    const paymentDate = new Date('2024-01-20T10:00:00Z');
    const installments = await db.insert(loanInstallmentsTable).values([
      {
        loan_id: loans[0].id,
        installment_number: 1,
        due_date: new Date('2024-01-15T00:00:00Z'),
        amount: '888.49',
        principal_amount: '788.49',
        interest_amount: '100.00',
        paid_amount: '888.49',
        paid_at: paymentDate,
        recorded_by: users[1].id,
        is_paid: true
      },
      {
        loan_id: loans[0].id,
        installment_number: 2,
        due_date: new Date('2024-02-15T00:00:00Z'),
        amount: '888.49',
        principal_amount: '796.27',
        interest_amount: '92.22',
        paid_amount: '0.00',
        is_paid: false
      }
    ]).returning().execute();

    const input: FinancialReportInput = {
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31')
    };

    const result = await generateFinancialReport(input);

    expect(result.loans.total_disbursed).toBe(10000); // Only loan disbursed in date range
    expect(result.loans.total_repaid).toBe(888.49); // Installment paid in date range
    expect(result.loans.outstanding_principal).toBe(8000); // Active loan remaining balance
    expect(result.loans.interest_earned).toBe(100); // Interest from paid installment
    expect(result.loans.active_loans).toBe(1);
    expect(result.loans.completed_loans).toBe(1);
  });

  it('should calculate installment collection statistics correctly', async () => {
    // Create test users
    const users = await db.insert(usersTable).values([
      {
        username: 'borrower1',
        email: 'borrower1@example.com',
        full_name: 'Borrower 1',
        role: 'member'
      },
      {
        username: 'admin1',
        email: 'admin1@example.com',
        full_name: 'Admin User',
        role: 'admin'
      }
    ]).returning().execute();

    // Create test loan
    const loans = await db.insert(loansTable).values([
      {
        user_id: users[0].id,
        amount: '10000.00',
        interest_rate: '12.00',
        term_months: 12,
        monthly_payment: '888.49',
        total_amount: '10661.88',
        remaining_balance: '8000.00',
        status: 'active',
        purpose: 'Business loan',
        approved_by: users[1].id,
        approved_at: new Date('2024-01-05T10:00:00Z'),
        disbursed_at: new Date('2024-01-10T10:00:00Z')
      }
    ]).returning().execute();

    // Create installments with different scenarios
    await db.insert(loanInstallmentsTable).values([
      {
        loan_id: loans[0].id,
        installment_number: 1,
        due_date: new Date('2024-01-15T00:00:00Z'),
        amount: '888.49',
        principal_amount: '788.49',
        interest_amount: '100.00',
        paid_amount: '888.49',
        paid_at: new Date('2024-01-20T10:00:00Z'),
        recorded_by: users[1].id,
        is_paid: true
      },
      {
        loan_id: loans[0].id,
        installment_number: 2,
        due_date: new Date('2024-01-25T00:00:00Z'),
        amount: '888.49',
        principal_amount: '796.27',
        interest_amount: '92.22',
        paid_amount: '400.00',
        paid_at: new Date('2024-01-26T10:00:00Z'),
        recorded_by: users[1].id,
        is_paid: false // Partial payment
      },
      {
        loan_id: loans[0].id,
        installment_number: 3,
        due_date: new Date('2024-01-30T00:00:00Z'),
        amount: '888.49',
        principal_amount: '804.16',
        interest_amount: '84.33',
        paid_amount: '0.00',
        is_paid: false // Overdue
      }
    ]).execute();

    const input: FinancialReportInput = {
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31')
    };

    const result = await generateFinancialReport(input);

    expect(result.installments.total_expected).toBe(2665.47); // Sum of all 3 installments due in range
    expect(result.installments.total_collected).toBe(1288.49); // 888.49 + 400.00 collected in range
    expect(result.installments.overdue_amount).toBeCloseTo(1376.98, 2); // 488.49 (partial) + 888.49 (unpaid)
    expect(result.installments.collection_rate).toBe(48.34); // (1288.49 / 2665.47) * 100, rounded to 2 decimals
  });

  it('should handle date range filters correctly', async () => {
    // Create test users
    const users = await db.insert(usersTable).values([
      {
        username: 'testuser1',
        email: 'test1@example.com',
        full_name: 'Test User 1',
        role: 'member'
      },
      {
        username: 'admin1',
        email: 'admin1@example.com',
        full_name: 'Admin User',
        role: 'admin'
      }
    ]).returning().execute();

    // Create test account
    const accounts = await db.insert(accountsTable).values([
      {
        user_id: users[0].id,
        account_number: 'ACC001',
        balance: '1000.00'
      }
    ]).returning().execute();

    // Create transactions - some within range, some outside
    await db.insert(transactionsTable).values([
      {
        account_id: accounts[0].id,
        type: 'deposit',
        amount: '100.00',
        description: 'Before range',
        processed_by: users[1].id,
        created_at: new Date('2023-12-31T10:00:00Z') // Outside range
      },
      {
        account_id: accounts[0].id,
        type: 'deposit',
        amount: '200.00',
        description: 'Within range',
        processed_by: users[1].id,
        created_at: new Date('2024-01-15T10:00:00Z') // Within range
      },
      {
        account_id: accounts[0].id,
        type: 'deposit',
        amount: '300.00',
        description: 'After range',
        processed_by: users[1].id,
        created_at: new Date('2024-02-01T10:00:00Z') // Outside range
      }
    ]).execute();

    const input: FinancialReportInput = {
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31')
    };

    const result = await generateFinancialReport(input);

    // Should only include transactions within the date range
    expect(result.savings.total_deposits).toBe(200);
    expect(result.savings.total_withdrawals).toBe(0);
    expect(result.savings.net_savings).toBe(200);
  });

  it('should handle complex multi-user scenario', async () => {
    // Create multiple users
    const users = await db.insert(usersTable).values([
      {
        username: 'member1',
        email: 'member1@example.com',
        full_name: 'Member 1',
        role: 'member'
      },
      {
        username: 'member2',
        email: 'member2@example.com',
        full_name: 'Member 2',
        role: 'member'
      },
      {
        username: 'admin1',
        email: 'admin1@example.com',
        full_name: 'Admin User',
        role: 'admin'
      }
    ]).returning().execute();

    // Create accounts for members
    const accounts = await db.insert(accountsTable).values([
      {
        user_id: users[0].id,
        account_number: 'ACC001',
        balance: '2000.00'
      },
      {
        user_id: users[1].id,
        account_number: 'ACC002',
        balance: '3000.00'
      }
    ]).returning().execute();

    // Create various transactions
    const testDate = new Date('2024-01-15T10:00:00Z');
    await db.insert(transactionsTable).values([
      {
        account_id: accounts[0].id,
        type: 'deposit',
        amount: '1000.00',
        processed_by: users[2].id,
        created_at: testDate
      },
      {
        account_id: accounts[1].id,
        type: 'deposit',
        amount: '500.00',
        processed_by: users[2].id,
        created_at: testDate
      },
      {
        account_id: accounts[0].id,
        type: 'withdrawal',
        amount: '300.00',
        processed_by: users[2].id,
        created_at: testDate
      }
    ]).execute();

    // Create loans
    const loans = await db.insert(loansTable).values([
      {
        user_id: users[0].id,
        amount: '5000.00',
        interest_rate: '12.00',
        term_months: 12,
        monthly_payment: '444.24',
        total_amount: '5330.88',
        remaining_balance: '4500.00',
        status: 'active',
        approved_by: users[2].id,
        disbursed_at: testDate
      },
      {
        user_id: users[1].id,
        amount: '3000.00',
        interest_rate: '10.00',
        term_months: 6,
        monthly_payment: '513.43',
        total_amount: '3080.58',
        remaining_balance: '0.00',
        status: 'completed',
        approved_by: users[2].id,
        disbursed_at: new Date('2023-12-01T10:00:00Z') // Outside range
      }
    ]).returning().execute();

    const input: FinancialReportInput = {
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31')
    };

    const result = await generateFinancialReport(input);

    expect(result.savings.total_deposits).toBe(1500); // 1000 + 500
    expect(result.savings.total_withdrawals).toBe(300);
    expect(result.savings.net_savings).toBe(1200);
    expect(result.savings.total_balance).toBe(5000); // 2000 + 3000
    expect(result.loans.total_disbursed).toBe(5000); // Only loan disbursed in range
    expect(result.loans.outstanding_principal).toBe(4500); // Active loan balance
    expect(result.loans.active_loans).toBe(1);
    expect(result.loans.completed_loans).toBe(1);
  });
});