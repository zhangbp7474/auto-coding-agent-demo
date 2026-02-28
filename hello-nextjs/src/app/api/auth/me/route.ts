import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
import { getUserById } from "@/lib/db/users";

const COOKIE_NAME = "auth_token";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = await getUserById(payload.userId);
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
