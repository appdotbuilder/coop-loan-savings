import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, accountsTable, transactionsTable } from '../db/schema';
import { getTransactionHistory } from '../handlers/get_transaction_history';

describe('getTransactionHistory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get transaction history for a user', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        phone: null,
        address: null,
        role: 'member',
        is_active: true
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create account for user
    const accountResult = await db.insert(accountsTable)
      .values({
        user_id: user.id,
        account_number: 'ACC001',
        balance: '100.00'
      })
      .returning()
      .execute();

    const account = accountResult[0];

    // Create test transactions with slight delays to ensure proper ordering
    await db.insert(transactionsTable)
      .values({
        account_id: account.id,
        type: 'deposit',
        amount: '50.00',
        description: 'Initial deposit',
        processed_by: user.id
      })
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(transactionsTable)
      .values({
        account_id: account.id,
        type: 'withdrawal',
        amount: '20.00',
        description: 'ATM withdrawal',
        processed_by: user.id
      })
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(transactionsTable)
      .values({
        account_id: account.id,
        type: 'deposit',
        amount: '30.00',
        description: 'Monthly savings',
        processed_by: user.id
      })
      .execute();

    const result = await getTransactionHistory(user.id);

    // Should return all 3 transactions
    expect(result).toHaveLength(3);

    // Verify transaction details and order (newest first)
    expect(result[0].type).toEqual('deposit');
    expect(result[0].amount).toEqual(30.00);
    expect(result[0].description).toEqual('Monthly savings');
    expect(typeof result[0].amount).toBe('number');

    expect(result[1].type).toEqual('withdrawal');
    expect(result[1].amount).toEqual(20.00);
    expect(result[1].description).toEqual('ATM withdrawal');

    expect(result[2].type).toEqual('deposit');
    expect(result[2].amount).toEqual(50.00);
    expect(result[2].description).toEqual('Initial deposit');

    // Verify all transactions belong to the correct account
    result.forEach(transaction => {
      expect(transaction.account_id).toEqual(account.id);
      expect(transaction.processed_by).toEqual(user.id);
      expect(transaction.created_at).toBeInstanceOf(Date);
      expect(transaction.id).toBeDefined();
    });
  });

  it('should return empty array for user with no transactions', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'emptyuser',
        email: 'empty@example.com',
        full_name: 'Empty User',
        phone: null,
        address: null,
        role: 'member',
        is_active: true
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create account for user but no transactions
    await db.insert(accountsTable)
      .values({
        user_id: user.id,
        account_number: 'ACC002',
        balance: '0.00'
      })
      .execute();

    const result = await getTransactionHistory(user.id);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should throw error for non-existent user', async () => {
    const nonExistentUserId = 999;

    await expect(getTransactionHistory(nonExistentUserId))
      .rejects.toThrow(/User with ID 999 not found/i);
  });

  it('should throw error for user without account', async () => {
    // Create test user without account
    const userResult = await db.insert(usersTable)
      .values({
        username: 'noaccountuser',
        email: 'noaccount@example.com',
        full_name: 'No Account User',
        phone: null,
        address: null,
        role: 'member',
        is_active: true
      })
      .returning()
      .execute();

    const user = userResult[0];

    await expect(getTransactionHistory(user.id))
      .rejects.toThrow(/No account found for user ID/i);
  });

  it('should handle transactions with different types correctly', async () => {
    // Create test user and account
    const userResult = await db.insert(usersTable)
      .values({
        username: 'typeuser',
        email: 'type@example.com',
        full_name: 'Type User',
        phone: null,
        address: null,
        role: 'member',
        is_active: true
      })
      .returning()
      .execute();

    const user = userResult[0];

    const accountResult = await db.insert(accountsTable)
      .values({
        user_id: user.id,
        account_number: 'ACC003',
        balance: '0.00'
      })
      .returning()
      .execute();

    const account = accountResult[0];

    // Create transactions with different types and amounts
    await db.insert(transactionsTable)
      .values([
        {
          account_id: account.id,
          type: 'deposit',
          amount: '1000.50',
          description: 'Large deposit',
          processed_by: user.id
        },
        {
          account_id: account.id,
          type: 'withdrawal',
          amount: '250.75',
          description: 'Partial withdrawal',
          processed_by: user.id
        }
      ])
      .execute();

    const result = await getTransactionHistory(user.id);

    expect(result).toHaveLength(2);

    // Check deposit transaction
    const deposit = result.find(t => t.type === 'deposit');
    expect(deposit).toBeDefined();
    expect(deposit!.amount).toEqual(1000.50);
    expect(deposit!.description).toEqual('Large deposit');
    expect(typeof deposit!.amount).toBe('number');

    // Check withdrawal transaction
    const withdrawal = result.find(t => t.type === 'withdrawal');
    expect(withdrawal).toBeDefined();
    expect(withdrawal!.amount).toEqual(250.75);
    expect(withdrawal!.description).toEqual('Partial withdrawal');
    expect(typeof withdrawal!.amount).toBe('number');
  });

  it('should handle transactions with null descriptions', async () => {
    // Create test user and account
    const userResult = await db.insert(usersTable)
      .values({
        username: 'nulldescuser',
        email: 'nulldesc@example.com',
        full_name: 'Null Desc User',
        phone: null,
        address: null,
        role: 'member',
        is_active: true
      })
      .returning()
      .execute();

    const user = userResult[0];

    const accountResult = await db.insert(accountsTable)
      .values({
        user_id: user.id,
        account_number: 'ACC004',
        balance: '0.00'
      })
      .returning()
      .execute();

    const account = accountResult[0];

    // Create transaction with null description
    await db.insert(transactionsTable)
      .values({
        account_id: account.id,
        type: 'deposit',
        amount: '100.00',
        description: null,
        processed_by: user.id
      })
      .execute();

    const result = await getTransactionHistory(user.id);

    expect(result).toHaveLength(1);
    expect(result[0].description).toBeNull();
    expect(result[0].amount).toEqual(100.00);
    expect(typeof result[0].amount).toBe('number');
  });
});