import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getUsers } from '../handlers/get_users';

// Test user inputs
const testUsers: CreateUserInput[] = [
  {
    username: 'john_doe',
    email: 'john.doe@example.com',
    full_name: 'John Doe',
    phone: '+1234567890',
    address: '123 Main St',
    role: 'member'
  },
  {
    username: 'jane_admin',
    email: 'jane.admin@example.com',
    full_name: 'Jane Admin',
    phone: '+1987654321',
    address: '456 Oak Ave',
    role: 'admin'
  },
  {
    username: 'bob_manager',
    email: 'bob.manager@example.com',
    full_name: 'Bob Manager',
    phone: null,
    address: null,
    role: 'cooperative_management'
  }
];

describe('getUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all active users', async () => {
    // Create test users
    await db.insert(usersTable).values(testUsers).execute();

    const result = await getUsers();

    expect(result).toHaveLength(3);
    
    // Verify all users are returned with correct data
    const usernames = result.map(user => user.username);
    expect(usernames).toContain('john_doe');
    expect(usernames).toContain('jane_admin');
    expect(usernames).toContain('bob_manager');

    // Verify user data structure
    result.forEach(user => {
      expect(user.id).toBeDefined();
      expect(user.username).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.full_name).toBeDefined();
      expect(user.role).toBeDefined();
      expect(user.is_active).toBe(true);
      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should return empty array when no users exist', async () => {
    const result = await getUsers();

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('should only return active users', async () => {
    // Create active users
    await db.insert(usersTable).values([
      testUsers[0], // active by default
      testUsers[1]  // active by default
    ]).execute();

    // Create inactive user
    await db.insert(usersTable).values({
      ...testUsers[2],
      is_active: false
    }).execute();

    const result = await getUsers();

    expect(result).toHaveLength(2);
    
    // Verify only active users are returned
    const usernames = result.map(user => user.username);
    expect(usernames).toContain('john_doe');
    expect(usernames).toContain('jane_admin');
    expect(usernames).not.toContain('bob_manager');

    // Verify all returned users are active
    result.forEach(user => {
      expect(user.is_active).toBe(true);
    });
  });

  it('should handle users with different roles', async () => {
    // Create users with all possible roles
    await db.insert(usersTable).values(testUsers).execute();

    const result = await getUsers();

    expect(result).toHaveLength(3);

    // Verify all role types are present
    const roles = result.map(user => user.role);
    expect(roles).toContain('member');
    expect(roles).toContain('admin');
    expect(roles).toContain('cooperative_management');
  });

  it('should handle users with nullable fields correctly', async () => {
    // Create user with null phone and address
    const userWithNulls: CreateUserInput = {
      username: 'test_user',
      email: 'test@example.com',
      full_name: 'Test User',
      phone: null,
      address: null,
      role: 'member'
    };

    await db.insert(usersTable).values(userWithNulls).execute();

    const result = await getUsers();

    expect(result).toHaveLength(1);
    
    const user = result[0];
    expect(user.username).toBe('test_user');
    expect(user.email).toBe('test@example.com');
    expect(user.full_name).toBe('Test User');
    expect(user.phone).toBeNull();
    expect(user.address).toBeNull();
    expect(user.role).toBe('member');
  });

  it('should return users sorted by creation order', async () => {
    // Create users one by one to ensure different creation times
    for (const user of testUsers) {
      await db.insert(usersTable).values(user).execute();
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const result = await getUsers();

    expect(result).toHaveLength(3);
    
    // Verify users are returned in creation order
    expect(result[0].username).toBe('john_doe');
    expect(result[1].username).toBe('jane_admin');
    expect(result[2].username).toBe('bob_manager');

    // Verify creation timestamps are in ascending order
    for (let i = 1; i < result.length; i++) {
      expect(result[i].created_at >= result[i - 1].created_at).toBe(true);
    }
  });
});