import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, accountsTable, transactionsTable } from '../db/schema';
import { type CreateTransactionInput } from '../schema';
import { createTransaction } from '../handlers/create_transaction';
import { eq } from 'drizzle-orm';

// Test setup data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'member' as const,
  phone: null,
  address: null
};

const testProcessor = {
  username: 'processor',
  email: 'processor@example.com',
  full_name: 'Transaction Processor',
  role: 'cooperative_management' as const,
  phone: null,
  address: null
};

describe('createTransaction', () => {
  let userId: number;
  let processorId: number;
  let accountId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test processor
    const processorResult = await db.insert(usersTable)
      .values(testProcessor)
      .returning()
      .execute();
    processorId = processorResult[0].id;

    // Create test account with initial balance
    const accountResult = await db.insert(accountsTable)
      .values({
        user_id: userId,
        account_number: 'ACC001',
        balance: '500.00' // Starting balance
      })
      .returning()
      .execute();
    accountId = accountResult[0].id;
  });

  afterEach(resetDB);

  describe('Deposit transactions', () => {
    it('should create a deposit transaction and update account balance', async () => {
      const depositInput: CreateTransactionInput = {
        account_id: accountId,
        type: 'deposit',
        amount: 100.00,
        description: 'Test deposit',
        processed_by: processorId
      };

      const result = await createTransaction(depositInput);

      // Verify transaction fields
      expect(result.account_id).toBe(accountId);
      expect(result.type).toBe('deposit');
      expect(result.amount).toBe(100.00);
      expect(typeof result.amount).toBe('number');
      expect(result.description).toBe('Test deposit');
      expect(result.processed_by).toBe(processorId);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);

      // Verify account balance was updated
      const updatedAccount = await db.select()
        .from(accountsTable)
        .where(eq(accountsTable.id, accountId))
        .execute();

      expect(parseFloat(updatedAccount[0].balance)).toBe(600.00); // 500 + 100
    });

    it('should save deposit transaction to database', async () => {
      const depositInput: CreateTransactionInput = {
        account_id: accountId,
        type: 'deposit',
        amount: 250.50,
        description: 'Monthly savings',
        processed_by: processorId
      };

      const result = await createTransaction(depositInput);

      // Query transaction from database
      const transactions = await db.select()
        .from(transactionsTable)
        .where(eq(transactionsTable.id, result.id))
        .execute();

      expect(transactions).toHaveLength(1);
      expect(transactions[0].account_id).toBe(accountId);
      expect(parseFloat(transactions[0].amount)).toBe(250.50);
      expect(transactions[0].type).toBe('deposit');
      expect(transactions[0].description).toBe('Monthly savings');
    });

    it('should handle deposit with null description', async () => {
      const depositInput: CreateTransactionInput = {
        account_id: accountId,
        type: 'deposit',
        amount: 75.25,
        description: null,
        processed_by: processorId
      };

      const result = await createTransaction(depositInput);

      expect(result.description).toBeNull();
      expect(result.amount).toBe(75.25);

      // Verify balance update
      const updatedAccount = await db.select()
        .from(accountsTable)
        .where(eq(accountsTable.id, accountId))
        .execute();

      expect(parseFloat(updatedAccount[0].balance)).toBe(575.25); // 500 + 75.25
    });
  });

  describe('Withdrawal transactions', () => {
    it('should create a withdrawal transaction and update account balance', async () => {
      const withdrawalInput: CreateTransactionInput = {
        account_id: accountId,
        type: 'withdrawal',
        amount: 150.00,
        description: 'Emergency withdrawal',
        processed_by: processorId
      };

      const result = await createTransaction(withdrawalInput);

      // Verify transaction fields
      expect(result.account_id).toBe(accountId);
      expect(result.type).toBe('withdrawal');
      expect(result.amount).toBe(150.00);
      expect(typeof result.amount).toBe('number');
      expect(result.description).toBe('Emergency withdrawal');
      expect(result.processed_by).toBe(processorId);

      // Verify account balance was updated
      const updatedAccount = await db.select()
        .from(accountsTable)
        .where(eq(accountsTable.id, accountId))
        .execute();

      expect(parseFloat(updatedAccount[0].balance)).toBe(350.00); // 500 - 150
    });

    it('should reject withdrawal when insufficient balance', async () => {
      const withdrawalInput: CreateTransactionInput = {
        account_id: accountId,
        type: 'withdrawal',
        amount: 600.00, // More than the 500 balance
        description: 'Large withdrawal',
        processed_by: processorId
      };

      await expect(createTransaction(withdrawalInput)).rejects.toThrow(/insufficient balance/i);

      // Verify account balance unchanged
      const account = await db.select()
        .from(accountsTable)
        .where(eq(accountsTable.id, accountId))
        .execute();

      expect(parseFloat(account[0].balance)).toBe(500.00); // Unchanged
    });

    it('should allow withdrawal of exact balance amount', async () => {
      const withdrawalInput: CreateTransactionInput = {
        account_id: accountId,
        type: 'withdrawal',
        amount: 500.00, // Exact balance
        description: 'Full withdrawal',
        processed_by: processorId
      };

      const result = await createTransaction(withdrawalInput);

      expect(result.amount).toBe(500.00);

      // Verify account balance is zero
      const updatedAccount = await db.select()
        .from(accountsTable)
        .where(eq(accountsTable.id, accountId))
        .execute();

      expect(parseFloat(updatedAccount[0].balance)).toBe(0.00);
    });
  });

  describe('Validation errors', () => {
    it('should reject transaction for non-existent account', async () => {
      const invalidInput: CreateTransactionInput = {
        account_id: 99999, // Non-existent account
        type: 'deposit',
        amount: 100.00,
        description: 'Test deposit',
        processed_by: processorId
      };

      await expect(createTransaction(invalidInput)).rejects.toThrow(/account not found/i);
    });

    it('should reject transaction with non-existent processor', async () => {
      const invalidInput: CreateTransactionInput = {
        account_id: accountId,
        type: 'deposit',
        amount: 100.00,
        description: 'Test deposit',
        processed_by: 99999 // Non-existent processor
      };

      await expect(createTransaction(invalidInput)).rejects.toThrow(/processing user not found/i);
    });
  });

  describe('Numeric handling', () => {
    it('should handle decimal amounts correctly', async () => {
      const depositInput: CreateTransactionInput = {
        account_id: accountId,
        type: 'deposit',
        amount: 123.45,
        description: 'Decimal test',
        processed_by: processorId
      };

      const result = await createTransaction(depositInput);

      expect(result.amount).toBe(123.45);
      expect(typeof result.amount).toBe('number');

      // Verify balance calculation with decimals
      const updatedAccount = await db.select()
        .from(accountsTable)
        .where(eq(accountsTable.id, accountId))
        .execute();

      expect(parseFloat(updatedAccount[0].balance)).toBe(623.45); // 500 + 123.45
    });

    it('should handle large amounts correctly', async () => {
      // First increase the account balance for withdrawal test
      await db.update(accountsTable)
        .set({ balance: '10000.00' })
        .where(eq(accountsTable.id, accountId))
        .execute();

      const largeInput: CreateTransactionInput = {
        account_id: accountId,
        type: 'withdrawal',
        amount: 9999.99,
        description: 'Large amount test',
        processed_by: processorId
      };

      const result = await createTransaction(largeInput);

      expect(result.amount).toBe(9999.99);

      // Verify balance calculation
      const updatedAccount = await db.select()
        .from(accountsTable)
        .where(eq(accountsTable.id, accountId))
        .execute();

      expect(parseFloat(updatedAccount[0].balance)).toBe(0.01); // 10000 - 9999.99
    });
  });
});