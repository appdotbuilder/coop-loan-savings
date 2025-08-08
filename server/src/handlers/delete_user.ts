export async function deleteUser(userId: number): Promise<{ success: boolean }> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is soft-deleting a user by setting is_active to false.
    // Should validate user exists, check if user has outstanding loans, and deactivate user.
    return Promise.resolve({ success: true });
}