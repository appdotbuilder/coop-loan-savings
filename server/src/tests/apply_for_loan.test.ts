import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, loansTable } from '../db/schema';
import { type CreateLoanApplicationInput } from '../schema';
import { applyForLoan } from '../handlers/apply_for_loan';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  full_name: 'Test User',
  phone: '123-456-7890',
  address: '123 Test St',
  role: 'member' as const
};

// Test loan application input
const testLoanInput: CreateLoanApplicationInput = {
  user_id: 1,
  amount: 5000.00,
  term_months: 12,
  purpose: 'Small business investment'
};

describe('applyForLoan', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a loan application with pending status', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const loanInput = {
      ...testLoanInput,
      user_id: userResult[0].id
    };

    const result = await applyForLoan(loanInput);

    // Verify loan application fields
    expect(result.user_id).toEqual(userResult[0].id);
    expect(result.amount).toEqual(5000.00);
    expect(typeof result.amount).toBe('number');
    expect(result.term_months).toEqual(12);
    expect(result.purpose).toEqual('Small business investment');
    expect(result.status).toEqual('pending');
    
    // Fields that should be set to defaults for pending applications
    expect(result.interest_rate).toEqual(0);
    expect(result.monthly_payment).toEqual(0);
    expect(result.total_amount).toEqual(0);
    expect(result.remaining_balance).toEqual(0);
    
    // Nullable fields should be null for pending applications
    expect(result.approved_by).toBeNull();
    expect(result.approved_at).toBeNull();
    expect(result.disbursed_at).toBeNull();
    
    // Auto-generated fields
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save loan application to database', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const loanInput = {
      ...testLoanInput,
      user_id: userResult[0].id
    };

    const result = await applyForLoan(loanInput);

    // Verify loan was saved in database
    const loans = await db.select()
      .from(loansTable)
      .where(eq(loansTable.id, result.id))
      .execute();

    expect(loans).toHaveLength(1);
    expect(loans[0].user_id).toEqual(userResult[0].id);
    expect(parseFloat(loans[0].amount)).toEqual(5000.00);
    expect(loans[0].term_months).toEqual(12);
    expect(loans[0].purpose).toEqual('Small business investment');
    expect(loans[0].status).toEqual('pending');
  });

  it('should handle loan application without purpose', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const loanInputWithoutPurpose = {
      user_id: userResult[0].id,
      amount: 3000.00,
      term_months: 6,
      purpose: null
    };

    const result = await applyForLoan(loanInputWithoutPurpose);

    expect(result.purpose).toBeNull();
    expect(result.user_id).toEqual(userResult[0].id);
    expect(result.amount).toEqual(3000.00);
    expect(result.term_months).toEqual(6);
    expect(result.status).toEqual('pending');
  });

  it('should throw error when user does not exist', async () => {
    const invalidLoanInput = {
      ...testLoanInput,
      user_id: 999 // Non-existent user ID
    };

    await expect(applyForLoan(invalidLoanInput))
      .rejects
      .toThrow(/User with ID 999 not found/i);
  });

  it('should handle multiple loan applications from same user', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const firstLoan = {
      user_id: userResult[0].id,
      amount: 2000.00,
      term_months: 6,
      purpose: 'First loan'
    };

    const secondLoan = {
      user_id: userResult[0].id,
      amount: 3000.00,
      term_months: 12,
      purpose: 'Second loan'
    };

    const result1 = await applyForLoan(firstLoan);
    const result2 = await applyForLoan(secondLoan);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.purpose).toEqual('First loan');
    expect(result2.purpose).toEqual('Second loan');
    expect(result1.amount).toEqual(2000.00);
    expect(result2.amount).toEqual(3000.00);

    // Verify both loans exist in database
    const allLoans = await db.select()
      .from(loansTable)
      .where(eq(loansTable.user_id, userResult[0].id))
      .execute();

    expect(allLoans).toHaveLength(2);
  });

  it('should handle numeric precision correctly', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const precisionLoanInput = {
      user_id: userResult[0].id,
      amount: 1234.56, // Test decimal precision
      term_months: 24,
      purpose: 'Precision test'
    };

    const result = await applyForLoan(precisionLoanInput);

    expect(result.amount).toEqual(1234.56);
    expect(typeof result.amount).toBe('number');
    
    // Verify precision is maintained in database
    const loans = await db.select()
      .from(loansTable)
      .where(eq(loansTable.id, result.id))
      .execute();

    expect(parseFloat(loans[0].amount)).toEqual(1234.56);
  });
});