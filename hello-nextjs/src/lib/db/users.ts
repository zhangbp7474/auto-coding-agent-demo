import { query, generateId } from "./client";
import type { User, UserInsert, UserUpdate } from "@/types/database";

export class UserError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "duplicate_email" | "invalid_data" | "database_error"
  ) {
    super(message);
    this.name = "UserError";
  }
}

export async function createUser(
  email: string,
  passwordHash: string,
  name?: string
): Promise<User> {
  const id = generateId();
  
  try {
    const result = await query<User>(
      `INSERT INTO users (id, email, password_hash, name, is_active) VALUES (?, ?, ?, ?, 1)`,
      [id, email, passwordHash, name ?? null]
    );
    
    if (result.rows.length === 0) {
      const fetchResult = await query<User>(
        `SELECT * FROM users WHERE id = ?`,
        [id]
      );
      return fetchResult.rows[0];
    }
    
    return result.rows[0];
  } catch (error) {
    const errorMessage = String(error);
    if (errorMessage.includes("UNIQUE constraint failed") || errorMessage.includes("duplicate key")) {
      throw new UserError("Email already registered", "duplicate_email");
    }
    throw new UserError(`Failed to create user: ${errorMessage}`, "database_error");
  }
}

export async function getUserById(userId: string): Promise<User | null> {
  const result = await query<User>(
    `SELECT * FROM users WHERE id = ?`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await query<User>(
    `SELECT * FROM users WHERE email = ?`,
    [email]
  );
  return result.rows[0] ?? null;
}

export async function updateUser(
  userId: string,
  updates: {
    name?: string;
    avatar_url?: string;
  }
): Promise<User> {
  const fields: string[] = [];
  const values: unknown[] = [];
  
  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.avatar_url !== undefined) {
    fields.push("avatar_url = ?");
    values.push(updates.avatar_url);
  }
  
  if (fields.length === 0) {
    const user = await getUserById(userId);
    if (!user) {
      throw new UserError("User not found", "not_found");
    }
    return user;
  }
  
  fields.push("updated_at = datetime('now')");
  values.push(userId);
  
  await query(
    `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
    values
  );
  
  const user = await getUserById(userId);
  if (!user) {
    throw new UserError("User not found", "not_found");
  }
  return user;
}

export async function updatePassword(
  userId: string,
  passwordHash: string
): Promise<void> {
  await query(
    `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`,
    [passwordHash, userId]
  );
}

export async function updateLastLogin(userId: string): Promise<void> {
  await query(
    `UPDATE users SET last_login_at = datetime('now') WHERE id = ?`,
    [userId]
  );
}

export async function deactivateUser(userId: string): Promise<void> {
  await query(
    `UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?`,
    [userId]
  );
}

export async function activateUser(userId: string): Promise<void> {
  await query(
    `UPDATE users SET is_active = 1, updated_at = datetime('now') WHERE id = ?`,
    [userId]
  );
}

export async function deleteUser(userId: string): Promise<void> {
  await query(`DELETE FROM users WHERE id = ?`, [userId]);
}
