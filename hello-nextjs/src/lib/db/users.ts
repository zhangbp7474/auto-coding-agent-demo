import { query } from "./client";
import type { User, UserInsert, UserUpdate } from "@/types/database";

export class UserError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "duplicate_email" | "invalid_password" | "database_error"
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
  try {
    const result = await query<User>(
      `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *`,
      [email.toLowerCase(), passwordHash, name || null]
    );
    return result.rows[0];
  } catch (error: unknown) {
    const pgError = error as { code?: string };
    if (pgError.code === "23505") {
      throw new UserError("Email already exists", "duplicate_email");
    }
    console.error("Error creating user:", error);
    throw new UserError("Failed to create user", "database_error");
  }
}

export async function getUserById(id: string): Promise<User | null> {
  const result = await query<User>(
    `SELECT * FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await query<User>(
    `SELECT * FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
}

export async function updateUser(
  id: string,
  updates: Partial<Omit<UserUpdate, "id" | "created_at">>
): Promise<User> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.avatar_url !== undefined) {
    fields.push(`avatar_url = $${paramIndex++}`);
    values.push(updates.avatar_url);
  }
  if (updates.is_active !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    values.push(updates.is_active);
  }

  if (fields.length === 0) {
    const user = await getUserById(id);
    if (!user) {
      throw new UserError("User not found", "not_found");
    }
    return user;
  }

  values.push(id);
  const result = await query<User>(
    `UPDATE users SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw new UserError("User not found", "not_found");
  }

  return result.rows[0];
}

export async function updateLastLogin(id: string): Promise<void> {
  await query(
    `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
    [id]
  );
}

export async function updatePassword(id: string, passwordHash: string): Promise<void> {
  const result = await query(
    `UPDATE users SET password_hash = $1 WHERE id = $2`,
    [passwordHash, id]
  );
  if (result.rowCount === 0) {
    throw new UserError("User not found", "not_found");
  }
}

export async function deleteUser(id: string): Promise<void> {
  const result = await query(
    `DELETE FROM users WHERE id = $1`,
    [id]
  );
  if (result.rowCount === 0) {
    throw new UserError("User not found", "not_found");
  }
}

export async function verifyUserCredentials(
  email: string,
  passwordHash: string
): Promise<User> {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new UserError("Invalid email or password", "invalid_password");
  }
  if (user.password_hash !== passwordHash) {
    throw new UserError("Invalid email or password", "invalid_password");
  }
  if (!user.is_active) {
    throw new UserError("Account is deactivated", "invalid_password");
  }
  return user;
}
