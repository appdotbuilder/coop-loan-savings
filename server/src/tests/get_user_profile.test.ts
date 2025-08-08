import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getUserProfile } from '../handlers/get_user_profile';

// Test user data
const testUser: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  full_name: 'Test User',
  phone: '+1234567890',
  address: '123 Test Street',
  role: 'member'
};

const testUserWithNulls: CreateUserInput = {
  username: 'testnulls',
  email: 'nulls@example.com',
  full_name: 'Test Nulls',
  phone: null,
  address: null,
  role: 'admin'
};

describe('getUserProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user profile for existing user', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        full_name: testUser.full_name,
        phone: testUser.phone,
        address: testUser.address,
        role: testUser.role
      })
      .returning()
      .execute();

    const createdUser = users[0];

    // Get user profile
    const result = await getUserProfile(createdUser.id);

    // Validate all fields
    expect(result.id).toBe(createdUser.id);
    expect(result.username).toBe('testuser');
    expect(result.email).toBe('test@example.com');
    expect(result.full_name).toBe('Test User');
    expect(result.phone).toBe('+1234567890');
    expect(result.address).toBe('123 Test Street');
    expect(result.role).toBe('member');
    expect(result.is_active).toBe(true);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should return user profile with null fields correctly', async () => {
    // Create test user with null phone and address
    const users = await db.insert(usersTable)
      .values({
        username: testUserWithNulls.username,
        email: testUserWithNulls.email,
        full_name: testUserWithNulls.full_name,
        phone: testUserWithNulls.phone,
        address: testUserWithNulls.address,
        role: testUserWithNulls.role
      })
      .returning()
      .execute();

    const createdUser = users[0];

    // Get user profile
    const result = await getUserProfile(createdUser.id);

    // Validate fields including null values
    expect(result.id).toBe(createdUser.id);
    expect(result.username).toBe('testnulls');
    expect(result.email).toBe('nulls@example.com');
    expect(result.full_name).toBe('Test Nulls');
    expect(result.phone).toBeNull();
    expect(result.address).toBeNull();
    expect(result.role).toBe('admin');
    expect(result.is_active).toBe(true);
  });

  it('should return user with different roles correctly', async () => {
    // Test with cooperative_management role
    const users = await db.insert(usersTable)
      .values({
        username: 'manager',
        email: 'manager@example.com',
        full_name: 'Test Manager',
        phone: null,
        address: null,
        role: 'cooperative_management'
      })
      .returning()
      .execute();

    const createdUser = users[0];

    // Get user profile
    const result = await getUserProfile(createdUser.id);

    expect(result.role).toBe('cooperative_management');
    expect(result.username).toBe('manager');
    expect(result.email).toBe('manager@example.com');
  });

  it('should return inactive user correctly', async () => {
    // Create inactive user
    const users = await db.insert(usersTable)
      .values({
        username: 'inactive',
        email: 'inactive@example.com',
        full_name: 'Inactive User',
        phone: null,
        address: null,
        role: 'member',
        is_active: false
      })
      .returning()
      .execute();

    const createdUser = users[0];

    // Get user profile
    const result = await getUserProfile(createdUser.id);

    expect(result.is_active).toBe(false);
    expect(result.username).toBe('inactive');
  });

  it('should throw error for non-existent user', async () => {
    // Try to get profile for non-existent user
    await expect(getUserProfile(999999)).rejects.toThrow(/user with id 999999 not found/i);
  });

  it('should throw error for invalid user ID', async () => {
    // Try to get profile for user ID 0
    await expect(getUserProfile(0)).rejects.toThrow(/user with id 0 not found/i);
  });

  it('should handle timestamps correctly', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values({
        username: 'timetest',
        email: 'time@example.com',
        full_name: 'Time Test',
        phone: null,
        address: null,
        role: 'member'
      })
      .returning()
      .execute();

    const createdUser = users[0];
    
    // Get user profile
    const result = await getUserProfile(createdUser.id);

    // Validate timestamps are Date objects
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    
    // Validate timestamps are reasonable (within last minute)
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(oneMinuteAgo.getTime());
    expect(result.created_at.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(oneMinuteAgo.getTime());
    expect(result.updated_at.getTime()).toBeLessThanOrEqual(now.getTime());
  });
});