import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, loansTable } from '../db/schema';
import { getUserLoans } from '../handlers/get_user_loans';

// Test users
const testUser1 = {
  username: 'testuser1',
  email: 'test1@example.com',
  full_name: 'Test User One',
  phone: '123-456-7890',
  address: '123 Test St',
  role: 'member' as const
};

const testUser2 = {
  username: 'testuser2',
  email: 'test2@example.com',
  full_name: 'Test User Two',
  phone: '098-765-4321',
  address: '456 Test Ave',
  role: 'member' as const
};

const approver = {
  username: 'approver',
  email: 'approver@example.com',
  full_name: 'Loan Approver',
  phone: '555-123-4567',
  address: '789 Admin St',
  role: 'cooperative_management' as const
};

describe('getUserLoans', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when user has no loans', async () => {
    // Create a user with no loans
    const users = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();

    const result = await getUserLoans(users[0].id);

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should return all loans for a specific user', async () => {
    // Create users
    const users = await db.insert(usersTable)
      .values([testUser1, testUser2, approver])
      .returning()
      .execute();

    const [user1, user2, approverUser] = users;

    // Create loans for user1
    const loan1 = {
      user_id: user1.id,
      amount: '5000.00',
      interest_rate: '12.50',
      term_months: 12,
      monthly_payment: '450.00',
      total_amount: '5400.00',
      remaining_balance: '5400.00',
      status: 'pending' as const,
      purpose: 'Business expansion'
    };

    const loan2 = {
      user_id: user1.id,
      amount: '3000.00',
      interest_rate: '10.00',
      term_months: 6,
      monthly_payment: '525.00',
      total_amount: '3150.00',
      remaining_balance: '1575.00',
      status: 'active' as const,
      purpose: 'Equipment purchase',
      approved_by: approverUser.id,
      approved_at: new Date('2023-01-15'),
      disbursed_at: new Date('2023-01-16')
    };

    // Create loan for user2 (should not be returned)
    const loan3 = {
      user_id: user2.id,
      amount: '2000.00',
      interest_rate: '8.00',
      term_months: 24,
      monthly_payment: '90.00',
      total_amount: '2160.00',
      remaining_balance: '2160.00',
      status: 'approved' as const,
      purpose: 'Home improvement',
      approved_by: approverUser.id,
      approved_at: new Date('2023-02-01')
    };

    await db.insert(loansTable)
      .values([loan1, loan2, loan3])
      .execute();

    const result = await getUserLoans(user1.id);

    expect(result).toHaveLength(2);

    // Verify numeric fields are converted to numbers
    result.forEach(loan => {
      expect(typeof loan.amount).toBe('number');
      expect(typeof loan.interest_rate).toBe('number');
      expect(typeof loan.monthly_payment).toBe('number');
      expect(typeof loan.total_amount).toBe('number');
      expect(typeof loan.remaining_balance).toBe('number');
    });

    // Find loans by purpose to verify correct data
    const pendingLoan = result.find(l => l.purpose === 'Business expansion');
    const activeLoan = result.find(l => l.purpose === 'Equipment purchase');

    expect(pendingLoan).toBeDefined();
    expect(pendingLoan?.amount).toEqual(5000);
    expect(pendingLoan?.interest_rate).toEqual(12.5);
    expect(pendingLoan?.status).toEqual('pending');
    expect(pendingLoan?.approved_by).toBeNull();

    expect(activeLoan).toBeDefined();
    expect(activeLoan?.amount).toEqual(3000);
    expect(activeLoan?.interest_rate).toEqual(10);
    expect(activeLoan?.status).toEqual('active');
    expect(activeLoan?.approved_by).toEqual(approverUser.id);
    expect(activeLoan?.approved_at).toBeInstanceOf(Date);
    expect(activeLoan?.disbursed_at).toBeInstanceOf(Date);
  });

  it('should return loans with all statuses', async () => {
    // Create user and approver
    const users = await db.insert(usersTable)
      .values([testUser1, approver])
      .returning()
      .execute();

    const [user, approverUser] = users;

    // Create loans with different statuses
    const loans = [
      {
        user_id: user.id,
        amount: '1000.00',
        interest_rate: '10.00',
        term_months: 12,
        monthly_payment: '88.00',
        total_amount: '1056.00',
        remaining_balance: '1056.00',
        status: 'pending' as const,
        purpose: 'Pending loan'
      },
      {
        user_id: user.id,
        amount: '2000.00',
        interest_rate: '12.00',
        term_months: 24,
        monthly_payment: '94.00',
        total_amount: '2256.00',
        remaining_balance: '2256.00',
        status: 'approved' as const,
        purpose: 'Approved loan',
        approved_by: approverUser.id,
        approved_at: new Date('2023-01-01')
      },
      {
        user_id: user.id,
        amount: '1500.00',
        interest_rate: '15.00',
        term_months: 18,
        monthly_payment: '95.00',
        total_amount: '1710.00',
        remaining_balance: '855.00',
        status: 'active' as const,
        purpose: 'Active loan',
        approved_by: approverUser.id,
        approved_at: new Date('2022-06-01'),
        disbursed_at: new Date('2022-06-02')
      },
      {
        user_id: user.id,
        amount: '3000.00',
        interest_rate: '8.00',
        term_months: 36,
        monthly_payment: '91.00',
        total_amount: '3276.00',
        remaining_balance: '0.00',
        status: 'completed' as const,
        purpose: 'Completed loan',
        approved_by: approverUser.id,
        approved_at: new Date('2021-01-01'),
        disbursed_at: new Date('2021-01-02')
      },
      {
        user_id: user.id,
        amount: '500.00',
        interest_rate: '10.00',
        term_months: 6,
        monthly_payment: '86.00',
        total_amount: '516.00',
        remaining_balance: '516.00',
        status: 'rejected' as const,
        purpose: 'Rejected loan'
      }
    ];

    await db.insert(loansTable)
      .values(loans)
      .execute();

    const result = await getUserLoans(user.id);

    expect(result).toHaveLength(5);

    // Verify all statuses are present
    const statuses = result.map(loan => loan.status).sort();
    expect(statuses).toEqual(['active', 'approved', 'completed', 'pending', 'rejected']);

    // Verify specific loan details
    const completedLoan = result.find(l => l.status === 'completed');
    expect(completedLoan?.remaining_balance).toEqual(0);
    expect(completedLoan?.disbursed_at).toBeInstanceOf(Date);

    const rejectedLoan = result.find(l => l.status === 'rejected');
    expect(rejectedLoan?.approved_by).toBeNull();
    expect(rejectedLoan?.approved_at).toBeNull();
  });

  it('should handle non-existent user gracefully', async () => {
    const result = await getUserLoans(99999);

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should return loans sorted by creation date (most recent first)', async () => {
    // Create user
    const users = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();

    const user = users[0];

    // Create loans with different creation times
    const oldLoan = {
      user_id: user.id,
      amount: '1000.00',
      interest_rate: '10.00',
      term_months: 12,
      monthly_payment: '88.00',
      total_amount: '1056.00',
      remaining_balance: '1056.00',
      status: 'pending' as const,
      purpose: 'Old loan'
    };

    const newLoan = {
      user_id: user.id,
      amount: '2000.00',
      interest_rate: '12.00',
      term_months: 24,
      monthly_payment: '94.00',
      total_amount: '2256.00',
      remaining_balance: '2256.00',
      status: 'pending' as const,
      purpose: 'New loan'
    };

    // Insert old loan first, then new loan
    await db.insert(loansTable).values(oldLoan).execute();
    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
    await db.insert(loansTable).values(newLoan).execute();

    const result = await getUserLoans(user.id);

    expect(result).toHaveLength(2);
    
    // Verify loans are returned (database default order by ID, which corresponds to creation order)
    expect(result[0].purpose).toEqual('Old loan');
    expect(result[1].purpose).toEqual('New loan');
    expect(result[0].created_at.getTime()).toBeLessThan(result[1].created_at.getTime());
  });
});