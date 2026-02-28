import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByEmail, updateLastLogin } from "@/lib/db/users";
import { verifyPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { UserError } from "@/lib/db/users";

const COOKIE_NAME = "auth_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: "Account is deactivated" },
        { status: 401 }
      );
    }

    await updateLastLogin(user.id);

    const token = signToken({
      userId: user.id,
      email: user.email,
    });

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    if (error instanceof UserError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "An error occurred during login" },
      { status: 500 }
    );
  }
}
