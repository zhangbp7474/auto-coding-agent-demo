import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
import { getUserById } from "@/lib/db/users";
import type { SafeUser } from "@/types/database";

const COOKIE_NAME = "auth_token";

export interface AuthSession {
  user: SafeUser | null;
  userId: string | null;
}

export async function getSession(): Promise<AuthSession> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
      return { user: null, userId: null };
    }

    const payload = await verifyToken(token);
    const user = await getUserById(payload.userId);

    if (!user) {
      return { user: null, userId: null };
    }

    const { password_hash: _, ...safeUser } = user;
    return { user: safeUser, userId: user.id };
  } catch {
    return { user: null, userId: null };
  }
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const session = await getSession();
  return session.user;
}

export async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession();
  return session.userId;
}

export async function requireAuth(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
