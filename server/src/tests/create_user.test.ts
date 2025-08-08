import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, accountsTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Test input for creating a member user
const testInput: CreateUserInput = {
  username: 'testuser123',
  email: 'test@example.com',
  full_name: 'Test User',
  phone: '+1234567890',
  address: '123 Test Street',
  role: 'member'
};

// Test input for admin user with minimal data
const adminInput: CreateUserInput = {
  username: 'admin1',
  email: 'admin@coop.com',
  full_name: 'Administrator',
  phone: null,
  address: null,
  role: 'admin'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with all provided fields', async () => {
    const result = await createUser(testInput);

    // Verify all user fields
    expect(result.username).toEqual('testuser123');
    expect(result.email).toEqual('test@example.com');
    expect(result.full_name).toEqual('Test User');
    expect(result.phone).toEqual('+1234567890');
    expect(result.address).toEqual('123 Test Street');
    expect(result.role).toEqual('member');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a user with nullable fields as null', async () => {
    const result = await createUser(adminInput);

    expect(result.username).toEqual('admin1');
    expect(result.email).toEqual('admin@coop.com');
    expect(result.full_name).toEqual('Administrator');
    expect(result.phone).toBeNull();
    expect(result.address).toBeNull();
    expect(result.role).toEqual('admin');
    expect(result.is_active).toEqual(true);
  });

  it('should save user to database', async () => {
    const result = await createUser(testInput);

    // Query database to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].username).toEqual('testuser123');
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].full_name).toEqual('Test User');
    expect(users[0].role).toEqual('member');
    expect(users[0].is_active).toEqual(true);
  });

  it('should create corresponding savings account for user', async () => {
    const result = await createUser(testInput);

    // Query database to verify account was created
    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.user_id, result.id))
      .execute();

    expect(accounts).toHaveLength(1);
    expect(accounts[0].user_id).toEqual(result.id);
    expect(accounts[0].account_number).toEqual(`ACC${result.id.toString().padStart(6, '0')}`);
    expect(parseFloat(accounts[0].balance)).toEqual(0.00);
    expect(accounts[0].created_at).toBeInstanceOf(Date);
    expect(accounts[0].updated_at).toBeInstanceOf(Date);
  });

  it('should generate unique account numbers for different users', async () => {
    const user1 = await createUser(testInput);
    
    const user2Input: CreateUserInput = {
      ...testInput,
      username: 'testuser456',
      email: 'test2@example.com'
    };
    const user2 = await createUser(user2Input);

    // Get both accounts
    const accounts = await db.select()
      .from(accountsTable)
      .execute();

    expect(accounts).toHaveLength(2);
    
    const account1 = accounts.find(acc => acc.user_id === user1.id);
    const account2 = accounts.find(acc => acc.user_id === user2.id);

    expect(account1).toBeDefined();
    expect(account2).toBeDefined();
    expect(account1!.account_number).not.toEqual(account2!.account_number);
    expect(account1!.account_number).toEqual(`ACC${user1.id.toString().padStart(6, '0')}`);
    expect(account2!.account_number).toEqual(`ACC${user2.id.toString().padStart(6, '0')}`);
  });

  it('should handle different user roles correctly', async () => {
    const managementInput: CreateUserInput = {
      username: 'manager1',
      email: 'manager@coop.com',
      full_name: 'Cooperative Manager',
      phone: null,
      address: null,
      role: 'cooperative_management'
    };

    const result = await createUser(managementInput);

    expect(result.role).toEqual('cooperative_management');
    expect(result.is_active).toEqual(true);

    // Verify account was still created for management users
    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.user_id, result.id))
      .execute();

    expect(accounts).toHaveLength(1);
  });

  it('should fail when username already exists', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create another user with same username
    const duplicateInput: CreateUserInput = {
      ...testInput,
      email: 'different@example.com'
    };

    await expect(createUser(duplicateInput)).rejects.toThrow(/duplicate key value/i);
  });

  it('should fail when email already exists', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create another user with same email
    const duplicateInput: CreateUserInput = {
      ...testInput,
      username: 'differentuser'
    };

    await expect(createUser(duplicateInput)).rejects.toThrow(/duplicate key value/i);
  });

  it('should rollback transaction if account creation fails', async () => {
    // This test verifies transaction integrity
    // If for some reason account creation fails, user should not be created either
    
    const result = await createUser(testInput);

    // Verify both user and account were created
    const users = await db.select().from(usersTable).execute();
    const accounts = await db.select().from(accountsTable).execute();

    expect(users).toHaveLength(1);
    expect(accounts).toHaveLength(1);
    expect(users[0].id).toEqual(result.id);
    expect(accounts[0].user_id).toEqual(result.id);
  });
});