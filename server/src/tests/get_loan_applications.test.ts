import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, loansTable } from '../db/schema';
import { getLoanApplications } from '../handlers/get_loan_applications';

describe('getLoanApplications', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no loans exist', async () => {
    const result = await getLoanApplications();
    expect(result).toEqual([]);
  });

  it('should return all loan applications', async () => {
    // Create test users first
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'user1',
          email: 'user1@test.com',
          full_name: 'User One',
          role: 'member'
        },
        {
          username: 'user2',
          email: 'user2@test.com',
          full_name: 'User Two',
          role: 'member'
        }
      ])
      .returning()
      .execute();

    // Create test loan applications
    const testLoans = await db.insert(loansTable)
      .values([
        {
          user_id: users[0].id,
          amount: '5000.00',
          interest_rate: '12.50',
          term_months: 12,
          monthly_payment: '450.00',
          total_amount: '5400.00',
          remaining_balance: '5400.00',
          status: 'pending',
          purpose: 'Business expansion'
        },
        {
          user_id: users[1].id,
          amount: '3000.00',
          interest_rate: '10.00',
          term_months: 24,
          monthly_payment: '138.00',
          total_amount: '3312.00',
          remaining_balance: '3312.00',
          status: 'approved',
          purpose: 'Education'
        }
      ])
      .returning()
      .execute();

    const result = await getLoanApplications();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(testLoans[0].id);
    expect(result[0].user_id).toBe(users[0].id);
    expect(result[0].amount).toBe(5000);
    expect(typeof result[0].amount).toBe('number');
    expect(result[0].interest_rate).toBe(12.5);
    expect(typeof result[0].interest_rate).toBe('number');
    expect(result[0].term_months).toBe(12);
    expect(result[0].monthly_payment).toBe(450);
    expect(typeof result[0].monthly_payment).toBe('number');
    expect(result[0].total_amount).toBe(5400);
    expect(typeof result[0].total_amount).toBe('number');
    expect(result[0].remaining_balance).toBe(5400);
    expect(typeof result[0].remaining_balance).toBe('number');
    expect(result[0].status).toBe('pending');
    expect(result[0].purpose).toBe('Business expansion');
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should return loans with different statuses', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@test.com',
        full_name: 'Test User',
        role: 'member'
      })
      .returning()
      .execute();

    // Create loans with different statuses
    await db.insert(loansTable)
      .values([
        {
          user_id: user[0].id,
          amount: '1000.00',
          interest_rate: '15.00',
          term_months: 6,
          monthly_payment: '180.00',
          total_amount: '1080.00',
          remaining_balance: '1080.00',
          status: 'pending'
        },
        {
          user_id: user[0].id,
          amount: '2000.00',
          interest_rate: '12.00',
          term_months: 12,
          monthly_payment: '177.70',
          total_amount: '2132.40',
          remaining_balance: '2132.40',
          status: 'approved'
        },
        {
          user_id: user[0].id,
          amount: '1500.00',
          interest_rate: '10.00',
          term_months: 18,
          monthly_payment: '92.20',
          total_amount: '1659.60',
          remaining_balance: '0.00',
          status: 'completed'
        }
      ])
      .execute();

    const result = await getLoanApplications();

    expect(result).toHaveLength(3);
    
    const statuses = result.map(loan => loan.status);
    expect(statuses).toContain('pending');
    expect(statuses).toContain('approved');
    expect(statuses).toContain('completed');
    
    // Verify all numeric fields are properly converted
    result.forEach(loan => {
      expect(typeof loan.amount).toBe('number');
      expect(typeof loan.interest_rate).toBe('number');
      expect(typeof loan.monthly_payment).toBe('number');
      expect(typeof loan.total_amount).toBe('number');
      expect(typeof loan.remaining_balance).toBe('number');
      expect(loan.created_at).toBeInstanceOf(Date);
      expect(loan.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should handle loans with nullable fields', async () => {
    // Create test user and approver
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'member',
          email: 'member@test.com',
          full_name: 'Member User',
          role: 'member'
        },
        {
          username: 'admin',
          email: 'admin@test.com',
          full_name: 'Admin User',
          role: 'admin'
        }
      ])
      .returning()
      .execute();

    // Create loan with some nullable fields populated
    const currentDate = new Date();
    await db.insert(loansTable)
      .values({
        user_id: users[0].id,
        amount: '2500.00',
        interest_rate: '8.50',
        term_months: 15,
        monthly_payment: '186.50',
        total_amount: '2797.50',
        remaining_balance: '2797.50',
        status: 'approved',
        purpose: 'Home improvement',
        approved_by: users[1].id,
        approved_at: currentDate,
        disbursed_at: currentDate
      })
      .execute();

    const result = await getLoanApplications();

    expect(result).toHaveLength(1);
    expect(result[0].purpose).toBe('Home improvement');
    expect(result[0].approved_by).toBe(users[1].id);
    expect(result[0].approved_at).toBeInstanceOf(Date);
    expect(result[0].disbursed_at).toBeInstanceOf(Date);
    
    // Verify numeric conversions still work
    expect(result[0].amount).toBe(2500);
    expect(result[0].interest_rate).toBe(8.5);
    expect(result[0].monthly_payment).toBe(186.5);
    expect(result[0].total_amount).toBe(2797.5);
    expect(result[0].remaining_balance).toBe(2797.5);
  });

  it('should return loans ordered by creation date (default database order)', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@test.com',
        full_name: 'Test User',
        role: 'member'
      })
      .returning()
      .execute();

    // Create multiple loans
    const loan1 = await db.insert(loansTable)
      .values({
        user_id: user[0].id,
        amount: '1000.00',
        interest_rate: '10.00',
        term_months: 12,
        monthly_payment: '87.92',
        total_amount: '1055.04',
        remaining_balance: '1055.04',
        status: 'pending',
        purpose: 'First loan'
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const loan2 = await db.insert(loansTable)
      .values({
        user_id: user[0].id,
        amount: '2000.00',
        interest_rate: '12.00',
        term_months: 18,
        monthly_payment: '125.48',
        total_amount: '2258.64',
        remaining_balance: '2258.64',
        status: 'pending',
        purpose: 'Second loan'
      })
      .returning()
      .execute();

    const result = await getLoanApplications();

    expect(result).toHaveLength(2);
    
    // Should be in order of creation (first loan first)
    expect(result[0].id).toBe(loan1[0].id);
    expect(result[0].purpose).toBe('First loan');
    expect(result[1].id).toBe(loan2[0].id);
    expect(result[1].purpose).toBe('Second loan');
    
    // Verify the created_at timestamps reflect the order
    expect(result[0].created_at.getTime()).toBeLessThanOrEqual(result[1].created_at.getTime());
  });
});