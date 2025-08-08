import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, accountsTable, loansTable } from '../db/schema';
import { deleteUser } from '../handlers/delete_user';
import { eq } from 'drizzle-orm';

describe('deleteUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should soft delete an active user with no outstanding loans', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        phone: '1234567890',
        address: '123 Test St',
        role: 'member'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create completed loan to ensure it doesn't block deletion
    await db.insert(loansTable)
      .values({
        user_id: userId,
        amount: '1000.00',
        interest_rate: '10.00',
        term_months: 12,
        monthly_payment: '87.92',
        total_amount: '1055.00',
        remaining_balance: '0.00',
        status: 'completed'
      })
      .execute();

    // Delete the user
    const result = await deleteUser(userId);

    // Verify result
    expect(result.success).toBe(true);

    // Verify user is deactivated in database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].is_active).toBe(false);
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error when user does not exist', async () => {
    const nonExistentUserId = 999;

    await expect(deleteUser(nonExistentUserId)).rejects.toThrow(/User with ID 999 not found/i);
  });

  it('should throw error when user is already inactive', async () => {
    // Create inactive user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'inactiveuser',
        email: 'inactive@example.com',
        full_name: 'Inactive User',
        role: 'member',
        is_active: false
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    await expect(deleteUser(userId)).rejects.toThrow(/User with ID \d+ is already inactive/i);
  });

  it('should throw error when user has active loan', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'userwithloan',
        email: 'withloan@example.com',
        full_name: 'User With Loan',
        role: 'member'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create active loan
    await db.insert(loansTable)
      .values({
        user_id: userId,
        amount: '5000.00',
        interest_rate: '12.00',
        term_months: 24,
        monthly_payment: '235.37',
        total_amount: '5648.88',
        remaining_balance: '3000.00',
        status: 'active'
      })
      .execute();

    await expect(deleteUser(userId)).rejects.toThrow(/Cannot deactivate user: has 1 outstanding loan/i);
  });

  it('should throw error when user has pending loan', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'userpending',
        email: 'pending@example.com',
        full_name: 'User With Pending Loan',
        role: 'member'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create pending loan
    await db.insert(loansTable)
      .values({
        user_id: userId,
        amount: '2000.00',
        interest_rate: '8.00',
        term_months: 12,
        monthly_payment: '174.03',
        total_amount: '2088.36',
        remaining_balance: '2000.00',
        status: 'pending'
      })
      .execute();

    await expect(deleteUser(userId)).rejects.toThrow(/Cannot deactivate user: has 1 outstanding loan/i);
  });

  it('should throw error when user has approved loan', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'userapproved',
        email: 'approved@example.com',
        full_name: 'User With Approved Loan',
        role: 'member'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create management user for approval
    const mgmtResult = await db.insert(usersTable)
      .values({
        username: 'manager',
        email: 'manager@example.com',
        full_name: 'Manager User',
        role: 'cooperative_management'
      })
      .returning()
      .execute();

    // Create approved loan
    await db.insert(loansTable)
      .values({
        user_id: userId,
        amount: '3000.00',
        interest_rate: '10.00',
        term_months: 18,
        monthly_payment: '188.71',
        total_amount: '3396.78',
        remaining_balance: '3000.00',
        status: 'approved',
        approved_by: mgmtResult[0].id,
        approved_at: new Date()
      })
      .execute();

    await expect(deleteUser(userId)).rejects.toThrow(/Cannot deactivate user: has 1 outstanding loan/i);
  });

  it('should allow deletion when user has multiple completed loans', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'multiloans',
        email: 'multiloans@example.com',
        full_name: 'User With Multiple Loans',
        role: 'member'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create multiple completed loans
    await db.insert(loansTable)
      .values([
        {
          user_id: userId,
          amount: '1000.00',
          interest_rate: '8.00',
          term_months: 12,
          monthly_payment: '86.99',
          total_amount: '1043.88',
          remaining_balance: '0.00',
          status: 'completed'
        },
        {
          user_id: userId,
          amount: '2000.00',
          interest_rate: '10.00',
          term_months: 24,
          monthly_payment: '92.29',
          total_amount: '2214.96',
          remaining_balance: '0.00',
          status: 'completed'
        }
      ])
      .execute();

    // Delete the user
    const result = await deleteUser(userId);

    // Verify result
    expect(result.success).toBe(true);

    // Verify user is deactivated
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(users[0].is_active).toBe(false);
  });

  it('should throw error when user has rejected loan and active loan', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'mixedloans',
        email: 'mixed@example.com',
        full_name: 'User With Mixed Loans',
        role: 'member'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create rejected loan (should not block deletion)
    await db.insert(loansTable)
      .values({
        user_id: userId,
        amount: '1000.00',
        interest_rate: '8.00',
        term_months: 12,
        monthly_payment: '86.99',
        total_amount: '1043.88',
        remaining_balance: '0.00',
        status: 'rejected'
      })
      .execute();

    // Create active loan (should block deletion)
    await db.insert(loansTable)
      .values({
        user_id: userId,
        amount: '2000.00',
        interest_rate: '10.00',
        term_months: 24,
        monthly_payment: '92.29',
        total_amount: '2214.96',
        remaining_balance: '1500.00',
        status: 'active'
      })
      .execute();

    await expect(deleteUser(userId)).rejects.toThrow(/Cannot deactivate user: has 1 outstanding loan/i);
  });
});