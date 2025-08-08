import { db } from '../db';
import { usersTable, accountsTable } from '../db/schema';
import { type CreateUserInput, type User } from '../schema';

export const createUser = async (input: CreateUserInput): Promise<User> => {
  try {
    // Start transaction to ensure both user and account are created together
    const result = await db.transaction(async (tx) => {
      // Insert user record
      const userResult = await tx.insert(usersTable)
        .values({
          username: input.username,
          email: input.email,
          full_name: input.full_name,
          phone: input.phone,
          address: input.address,
          role: input.role
        })
        .returning()
        .execute();

      const user = userResult[0];

      // Generate unique account number (simple format: ACC + user_id padded to 6 digits)
      const account_number = `ACC${user.id.toString().padStart(6, '0')}`;

      // Create corresponding savings account for the user
      await tx.insert(accountsTable)
        .values({
          user_id: user.id,
          account_number: account_number,
          balance: '0.00' // Start with zero balance
        })
        .execute();

      return user;
    });

    return result;
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
};