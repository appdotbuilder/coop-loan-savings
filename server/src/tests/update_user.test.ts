import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UpdateUserInput, type CreateUserInput } from '../schema';
import { updateUser } from '../handlers/update_user';
import { eq } from 'drizzle-orm';

// Helper function to create a test user
const createTestUser = async (): Promise<number> => {
  const testUser: CreateUserInput = {
    username: 'testuser',
    email: 'test@example.com',
    full_name: 'Test User',
    phone: '+1234567890',
    address: '123 Test Street',
    role: 'member'
  };

  const result = await db.insert(usersTable)
    .values(testUser)
    .returning()
    .execute();

  return result[0].id;
};

describe('updateUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update user with all fields', async () => {
    const userId = await createTestUser();

    const updateInput: UpdateUserInput = {
      id: userId,
      username: 'updateduser',
      email: 'updated@example.com',
      full_name: 'Updated User Name',
      phone: '+9876543210',
      address: '456 Updated Avenue',
      role: 'cooperative_management',
      is_active: false
    };

    const result = await updateUser(updateInput);

    // Verify all fields were updated
    expect(result.id).toEqual(userId);
    expect(result.username).toEqual('updateduser');
    expect(result.email).toEqual('updated@example.com');
    expect(result.full_name).toEqual('Updated User Name');
    expect(result.phone).toEqual('+9876543210');
    expect(result.address).toEqual('456 Updated Avenue');
    expect(result.role).toEqual('cooperative_management');
    expect(result.is_active).toEqual(false);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should update only provided fields', async () => {
    const userId = await createTestUser();

    // Update only username and role
    const updateInput: UpdateUserInput = {
      id: userId,
      username: 'partialupdateuser',
      role: 'admin'
    };

    const result = await updateUser(updateInput);

    // Verify updated fields
    expect(result.username).toEqual('partialupdateuser');
    expect(result.role).toEqual('admin');

    // Verify unchanged fields remain the same
    expect(result.email).toEqual('test@example.com');
    expect(result.full_name).toEqual('Test User');
    expect(result.phone).toEqual('+1234567890');
    expect(result.address).toEqual('123 Test Street');
    expect(result.is_active).toEqual(true);
  });

  it('should update nullable fields to null', async () => {
    const userId = await createTestUser();

    const updateInput: UpdateUserInput = {
      id: userId,
      phone: null,
      address: null
    };

    const result = await updateUser(updateInput);

    // Verify nullable fields were set to null
    expect(result.phone).toBeNull();
    expect(result.address).toBeNull();

    // Verify other fields remain unchanged
    expect(result.username).toEqual('testuser');
    expect(result.email).toEqual('test@example.com');
    expect(result.full_name).toEqual('Test User');
    expect(result.role).toEqual('member');
    expect(result.is_active).toEqual(true);
  });

  it('should update user status from active to inactive', async () => {
    const userId = await createTestUser();

    const updateInput: UpdateUserInput = {
      id: userId,
      is_active: false
    };

    const result = await updateUser(updateInput);

    expect(result.is_active).toEqual(false);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update user role from member to cooperative_management', async () => {
    const userId = await createTestUser();

    const updateInput: UpdateUserInput = {
      id: userId,
      role: 'cooperative_management'
    };

    const result = await updateUser(updateInput);

    expect(result.role).toEqual('cooperative_management');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save updated user to database', async () => {
    const userId = await createTestUser();

    const updateInput: UpdateUserInput = {
      id: userId,
      username: 'dbverifyuser',
      email: 'dbverify@example.com'
    };

    await updateUser(updateInput);

    // Verify the changes were persisted in the database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].username).toEqual('dbverifyuser');
    expect(users[0].email).toEqual('dbverify@example.com');
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error when user does not exist', async () => {
    const nonExistentId = 999999;

    const updateInput: UpdateUserInput = {
      id: nonExistentId,
      username: 'nonexistent'
    };

    await expect(updateUser(updateInput)).rejects.toThrow(/User with ID 999999 not found/i);
  });

  it('should handle email uniqueness constraint violation', async () => {
    // Create two test users
    const userId1 = await createTestUser();
    
    // Create second user with different email
    const secondUser = await db.insert(usersTable)
      .values({
        username: 'testuser2',
        email: 'test2@example.com',
        full_name: 'Test User 2',
        role: 'member'
      })
      .returning()
      .execute();

    const userId2 = secondUser[0].id;

    // Try to update second user to have same email as first user
    const updateInput: UpdateUserInput = {
      id: userId2,
      email: 'test@example.com' // This email already exists for userId1
    };

    await expect(updateUser(updateInput)).rejects.toThrow();
  });

  it('should handle username uniqueness constraint violation', async () => {
    // Create two test users
    const userId1 = await createTestUser();
    
    // Create second user with different username
    const secondUser = await db.insert(usersTable)
      .values({
        username: 'testuser2',
        email: 'test2@example.com',
        full_name: 'Test User 2',
        role: 'member'
      })
      .returning()
      .execute();

    const userId2 = secondUser[0].id;

    // Try to update second user to have same username as first user
    const updateInput: UpdateUserInput = {
      id: userId2,
      username: 'testuser' // This username already exists for userId1
    };

    await expect(updateUser(updateInput)).rejects.toThrow();
  });

  it('should update user with minimal input (only id and one field)', async () => {
    const userId = await createTestUser();

    const updateInput: UpdateUserInput = {
      id: userId,
      full_name: 'Minimally Updated Name'
    };

    const result = await updateUser(updateInput);

    expect(result.full_name).toEqual('Minimally Updated Name');
    expect(result.updated_at).toBeInstanceOf(Date);
    
    // All other fields should remain unchanged
    expect(result.username).toEqual('testuser');
    expect(result.email).toEqual('test@example.com');
    expect(result.phone).toEqual('+1234567890');
    expect(result.address).toEqual('123 Test Street');
    expect(result.role).toEqual('member');
    expect(result.is_active).toEqual(true);
  });
});