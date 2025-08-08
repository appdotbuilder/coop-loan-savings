import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, accountsTable } from '../db/schema';
import { getSavingsBalance } from '../handlers/get_savings_balance';
import { eq } from 'drizzle-orm';

// Test data for user creation
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  full_name: 'Test User',
  phone: '+1234567890',
  address: '123 Test St',
  role: 'member' as const,
  is_active: true
};

// Test data for account creation
const testAccount = {
  account_number: 'ACC123456',
  balance: '1500.75' // Stored as string in database
};

describe('getSavingsBalance', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get savings balance for existing user', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create savings account for user
    const accountResult = await db.insert(accountsTable)
      .values({
        user_id: userId,
        ...testAccount
      })
      .returning()
      .execute();

    // Call handler
    const result = await getSavingsBalance(userId);

    // Verify account details
    expect(result.id).toEqual(accountResult[0].id);
    expect(result.user_id).toEqual(userId);
    expect(result.account_number).toEqual('ACC123456');
    expect(result.balance).toEqual(1500.75);
    expect(typeof result.balance).toEqual('number'); // Verify numeric conversion
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should get account with zero balance', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create account with zero balance
    await db.insert(accountsTable)
      .values({
        user_id: userId,
        account_number: 'ACC000000',
        balance: '0.00' // Zero balance as string
      })
      .returning()
      .execute();

    // Call handler
    const result = await getSavingsBalance(userId);

    // Verify zero balance is handled correctly
    expect(result.balance).toEqual(0);
    expect(typeof result.balance).toEqual('number');
    expect(result.user_id).toEqual(userId);
    expect(result.account_number).toEqual('ACC000000');
  });

  it('should get account with large balance', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create account with large balance
    await db.insert(accountsTable)
      .values({
        user_id: userId,
        account_number: 'ACC999999',
        balance: '999999.99' // Large balance as string
      })
      .returning()
      .execute();

    // Call handler
    const result = await getSavingsBalance(userId);

    // Verify large balance is handled correctly
    expect(result.balance).toEqual(999999.99);
    expect(typeof result.balance).toEqual('number');
    expect(result.user_id).toEqual(userId);
  });

  it('should throw error for non-existent user', async () => {
    const nonExistentUserId = 99999;

    // Call handler and expect error
    await expect(getSavingsBalance(nonExistentUserId))
      .rejects
      .toThrow(/User with ID 99999 not found/i);
  });

  it('should throw error for user without savings account', async () => {
    // Create test user but no account
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Call handler and expect error
    await expect(getSavingsBalance(userId))
      .rejects
      .toThrow(/No savings account found for user ID/i);
  });

  it('should verify account exists in database after retrieval', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create savings account
    await db.insert(accountsTable)
      .values({
        user_id: userId,
        account_number: 'ACC555555',
        balance: '2500.50'
      })
      .returning()
      .execute();

    // Call handler
    const result = await getSavingsBalance(userId);

    // Verify the account actually exists in database
    const dbAccount = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, result.id))
      .execute();

    expect(dbAccount).toHaveLength(1);
    expect(dbAccount[0].user_id).toEqual(userId);
    expect(dbAccount[0].account_number).toEqual('ACC555555');
    expect(parseFloat(dbAccount[0].balance)).toEqual(2500.50);
  });

  it('should handle account with decimal precision', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create account with precise decimal balance
    await db.insert(accountsTable)
      .values({
        user_id: userId,
        account_number: 'ACC777777',
        balance: '123.45' // Precise decimal
      })
      .returning()
      .execute();

    // Call handler
    const result = await getSavingsBalance(userId);

    // Verify decimal precision is maintained
    expect(result.balance).toEqual(123.45);
    expect(result.balance.toFixed(2)).toEqual('123.45');
  });
});